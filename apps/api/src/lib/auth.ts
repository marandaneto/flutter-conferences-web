import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { eq, gt, and } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { db } from "../db/client.js";
import { sessions, users, type UserRow } from "../db/schema.js";
import { env } from "../env.js";

export const SESSION_COOKIE = "fc_session";
const SESSION_TTL_DAYS = 30;

export type AuthContext =
  | { kind: "user"; user: UserRow; sessionId: string }
  | { kind: "token" }
  | { kind: "none" };

function newSessionId(): string {
  return randomBytes(32).toString("hex");
}

export async function createSessionForUser(userId: string): Promise<string> {
  const id = newSessionId();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  await db.insert(sessions).values({ id, userId, expiresAt });
  return id;
}

export async function destroySession(id: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, id));
}

async function lookupSessionUser(sessionId: string): Promise<UserRow | null> {
  const row = await db.query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())),
  });
  if (!row) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.id, row.userId),
  });
  return user ?? null;
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function parseBearer(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length);
}

export async function resolveAuth(req: FastifyRequest): Promise<AuthContext> {
  // 1. Authorization header — used for the break-glass admin token.
  const bearer = parseBearer(req.headers.authorization);
  if (bearer && constantTimeEq(bearer, env.ADMIN_TOKEN)) {
    return { kind: "token" };
  }

  // 2. Session cookie (preferred path for signed-in users).
  const cookieSid = req.cookies?.[SESSION_COOKIE];
  if (cookieSid) {
    const user = await lookupSessionUser(cookieSid);
    if (user) return { kind: "user", user, sessionId: cookieSid };
  }

  // 3. Authorization Bearer as session id — back-compat for the
  //    pre-cookie deploy where the web app stored the session in
  //    localStorage. Drop after a transition window.
  if (bearer) {
    const user = await lookupSessionUser(bearer);
    if (user) return { kind: "user", user, sessionId: bearer };
  }

  return { kind: "none" };
}

export function sessionCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}

const STATE_TTL_MS = 10 * 60 * 1000;

export function signOAuthState(returnTo: string): string {
  const payload = `${Date.now()}:${returnTo}`;
  const secret = env.SESSION_SECRET ?? env.ADMIN_TOKEN;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyOAuthState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon < 0) return null;
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const secret = env.SESSION_SECRET ?? env.ADMIN_TOKEN;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
    const [tsStr, ...rest] = payload.split(":");
    const ts = Number(tsStr);
    if (!ts || Date.now() - ts > STATE_TTL_MS) return null;
    return rest.join(":");
  } catch {
    return null;
  }
}
