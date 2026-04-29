import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  ADMIN_BEARER,
  buildTestApp,
  insertSession,
  insertUser,
  truncateAll,
} from "./helpers.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await truncateAll();
});

describe("/api/auth/me", () => {
  it("returns unauthenticated with no credentials", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ authenticated: false });
  });

  it("recognizes the break-glass admin token via Authorization header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: ADMIN_BEARER },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ authenticated: true, kind: "token" });
  });

  it("recognizes a session cookie for an admin user", async () => {
    const user = await insertUser({
      githubLogin: "admin-user",
      isAdmin: true,
    });
    const sid = await insertSession(user.id);

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { fc_session: sid },
    });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.authenticated).toBe(true);
    expect(body.kind).toBe("user");
    expect(body.user.githubLogin).toBe("admin-user");
    expect(body.user.isAdmin).toBe(true);
  });

  it("recognizes a session id sent as Authorization Bearer (back-compat)", async () => {
    const user = await insertUser({ githubLogin: "guest-user" });
    const sid = await insertSession(user.id);

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${sid}` },
    });
    const body = res.json();
    expect(body.authenticated).toBe(true);
    expect(body.user.isAdmin).toBe(false);
  });

  it("returns unauthenticated for an unknown bearer token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: "Bearer not-a-real-session" },
    });
    expect(res.json()).toEqual({ authenticated: false });
  });
});

describe("admin route gate", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/conferences",
    });
    expect(res.statusCode).toBe(401);
  });

  it("accepts the admin token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/conferences",
      headers: { authorization: ADMIN_BEARER },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("rejects an authenticated non-admin user with 403", async () => {
    const user = await insertUser({ githubLogin: "guest", isAdmin: false });
    const sid = await insertSession(user.id);

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/conferences",
      cookies: { fc_session: sid },
    });
    expect(res.statusCode).toBe(403);
  });

  it("accepts an admin user via cookie", async () => {
    const user = await insertUser({ githubLogin: "admin", isAdmin: true });
    const sid = await insertSession(user.id);

    const res = await app.inject({
      method: "GET",
      url: "/api/admin/conferences",
      cookies: { fc_session: sid },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe("/api/auth/logout", () => {
  it("destroys the session and clears the cookie", async () => {
    const user = await insertUser({ githubLogin: "x", isAdmin: true });
    const sid = await insertSession(user.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { fc_session: sid },
    });
    expect(res.statusCode).toBe(200);
    const setCookie = res.headers["set-cookie"];
    expect(String(setCookie)).toMatch(/fc_session=;/);

    // Session row should be gone — re-using it now returns unauthenticated.
    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { fc_session: sid },
    });
    expect(me.json()).toEqual({ authenticated: false });
  });
});
