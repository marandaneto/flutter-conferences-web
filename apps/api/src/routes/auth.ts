import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { invites, users, type UserRow } from "../db/schema.js";
import { env } from "../env.js";
import {
  SESSION_COOKIE,
  createSessionForUser,
  destroySession,
  resolveAuth,
  sessionCookieOptions,
  signOAuthState,
  verifyOAuthState,
} from "../lib/auth.js";

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_USER = "https://api.github.com/user";

function publicUser(u: UserRow) {
  return {
    id: u.id,
    githubLogin: u.githubLogin,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt.toISOString(),
  };
}

function oauthConfigured(): boolean {
  return Boolean(
    env.GITHUB_CLIENT_ID &&
      env.GITHUB_CLIENT_SECRET &&
      env.GITHUB_OAUTH_CALLBACK_URL,
  );
}

export async function authRoutes(app: FastifyInstance) {
  app.get("/api/auth/me", async (req) => {
    const auth = await resolveAuth(req);
    if (auth.kind === "user") {
      return { authenticated: true, kind: "user", user: publicUser(auth.user) };
    }
    if (auth.kind === "token") {
      return { authenticated: true, kind: "token" };
    }
    return { authenticated: false };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const auth = await resolveAuth(req);
    if (auth.kind === "user") {
      await destroySession(auth.sessionId);
    }
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/auth/github/start", async (req, reply) => {
    if (!oauthConfigured()) {
      return reply.code(503).send({ error: "github oauth not configured" });
    }
    const returnTo = (req.query as { return_to?: string }).return_to ?? "/admin";
    const state = signOAuthState(returnTo);
    const url = new URL(GITHUB_AUTHORIZE);
    url.searchParams.set("client_id", env.GITHUB_CLIENT_ID!);
    url.searchParams.set("redirect_uri", env.GITHUB_OAUTH_CALLBACK_URL!);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    return reply.redirect(url.toString());
  });

  app.get("/auth/github/callback", async (req, reply) => {
    if (!oauthConfigured()) {
      return reply.code(503).send({ error: "github oauth not configured" });
    }
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) {
      return reply.code(400).send({ error: "missing code or state" });
    }
    const returnTo = verifyOAuthState(state);
    if (returnTo === null) {
      return reply.code(400).send({ error: "invalid state" });
    }

    const tokenRes = await fetch(GITHUB_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.GITHUB_OAUTH_CALLBACK_URL,
      }),
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      app.log.error({ status: tokenRes.status, body: txt }, "github token exchange failed");
      return redirectWithError(reply, returnTo, "github_token_exchange_failed");
    }
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };
    if (!tokenJson.access_token) {
      app.log.error({ tokenJson }, "github token missing");
      return redirectWithError(reply, returnTo, tokenJson.error ?? "github_no_token");
    }

    const userRes = await fetch(GITHUB_USER, {
      headers: {
        authorization: `Bearer ${tokenJson.access_token}`,
        accept: "application/vnd.github+json",
        "user-agent": "flutterconferences",
      },
    });
    if (!userRes.ok) {
      return redirectWithError(reply, returnTo, "github_user_fetch_failed");
    }
    const ghUser = (await userRes.json()) as {
      id: number;
      login: string;
      name: string | null;
      email: string | null;
      avatar_url: string | null;
    };

    const pendingInvite = await db.query.invites.findFirst({
      where: eq(invites.githubLogin, ghUser.login),
    });
    const shouldGrantAdmin = !!pendingInvite && !pendingInvite.acceptedAt;

    let user = await db.query.users.findFirst({
      where: eq(users.githubId, ghUser.id),
    });

    if (!user) {
      const [created] = await db
        .insert(users)
        .values({
          githubId: ghUser.id,
          githubLogin: ghUser.login,
          name: ghUser.name,
          email: ghUser.email,
          avatarUrl: ghUser.avatar_url,
          isAdmin: shouldGrantAdmin,
        })
        .returning();
      user = created!;
    } else {
      const update: Record<string, unknown> = {
        githubLogin: ghUser.login,
        name: ghUser.name,
        email: ghUser.email,
        avatarUrl: ghUser.avatar_url,
        updatedAt: new Date(),
      };
      if (shouldGrantAdmin) update.isAdmin = true;
      await db.update(users).set(update).where(eq(users.id, user.id));
    }

    if (shouldGrantAdmin) {
      await db
        .update(invites)
        .set({ acceptedAt: new Date() })
        .where(eq(invites.id, pendingInvite!.id));
    }

    const sid = await createSessionForUser(user.id);
    reply.setCookie(SESSION_COOKIE, sid, sessionCookieOptions());
    return reply.redirect(joinReturnTo(env.WEB_URL, returnTo));
  });
}

function joinReturnTo(webUrl: string, returnTo: string): string {
  const path = returnTo.startsWith("/") ? returnTo : "/admin";
  return `${webUrl.replace(/\/$/, "")}${path}`;
}

function redirectWithError(reply: any, returnTo: string, error: string) {
  const path = returnTo.startsWith("/") ? returnTo : "/admin";
  const url = new URL(path, env.WEB_URL);
  url.searchParams.set("auth_error", error);
  return reply.redirect(url.toString());
}
