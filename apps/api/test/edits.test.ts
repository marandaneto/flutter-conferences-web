import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../src/db/client.js";
import { conferences } from "../src/db/schema.js";
import {
  ADMIN_BEARER,
  buildTestApp,
  insertApprovedConference,
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

describe("edit suggestions", () => {
  it("rejects unauthenticated edits with 401", async () => {
    const target = await insertApprovedConference({ slug: "edit-target-1" });
    const res = await app.inject({
      method: "POST",
      url: `/api/conferences/${target.slug}/edits`,
      payload: { ...target, dateStart: "2027-01-10", dateEnd: "2027-01-12" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 for unknown slug", async () => {
    const user = await insertUser();
    const sid = await insertSession(user.id);
    const res = await app.inject({
      method: "POST",
      url: "/api/conferences/does-not-exist/edits",
      cookies: { fc_session: sid },
      payload: {
        name: "x",
        website: "https://x.example",
        location: "x",
        online: false,
        dateStart: "2027-01-01",
        dateEnd: "2027-01-02",
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("creates a pending edit for an authenticated user", async () => {
    const target = await insertApprovedConference({ slug: "edit-target-2" });
    const user = await insertUser({ githubLogin: "editor" });
    const sid = await insertSession(user.id);

    const res = await app.inject({
      method: "POST",
      url: `/api/conferences/${target.slug}/edits`,
      cookies: { fc_session: sid },
      payload: {
        name: "Updated Name",
        website: target.website,
        location: target.location,
        online: target.online,
        dateStart: target.dateStart,
        dateEnd: target.dateEnd,
        submissionNote: "fixed the name",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().moderationStatus).toBe("pending");
    expect(res.json().proposed.name).toBe("Updated Name");
  });

  it("approve applies proposed values to the target conference", async () => {
    const target = await insertApprovedConference({
      slug: "edit-target-3",
      name: "Old Name",
      location: "Berlin",
    });
    const user = await insertUser({ githubLogin: "editor" });
    const sid = await insertSession(user.id);

    const create = await app.inject({
      method: "POST",
      url: `/api/conferences/${target.slug}/edits`,
      cookies: { fc_session: sid },
      payload: {
        name: "Brand New Name",
        website: target.website,
        location: "Lisbon",
        online: target.online,
        dateStart: target.dateStart,
        dateEnd: target.dateEnd,
      },
    });
    const editId = create.json().id;

    const approve = await app.inject({
      method: "POST",
      url: `/api/admin/edits/${editId}/approve`,
      headers: { authorization: ADMIN_BEARER },
    });
    expect(approve.statusCode).toBe(200);

    const after = await db.query.conferences.findFirst({
      where: eq(conferences.id, target.id),
    });
    expect(after?.name).toBe("Brand New Name");
    expect(after?.location).toBe("Lisbon");
  });

  it("reject leaves the target unchanged and stores the reason", async () => {
    const target = await insertApprovedConference({
      slug: "edit-target-4",
      name: "Original",
    });
    const user = await insertUser();
    const sid = await insertSession(user.id);

    const create = await app.inject({
      method: "POST",
      url: `/api/conferences/${target.slug}/edits`,
      cookies: { fc_session: sid },
      payload: {
        name: "Bogus Edit",
        website: target.website,
        location: target.location,
        online: target.online,
        dateStart: target.dateStart,
        dateEnd: target.dateEnd,
      },
    });
    const editId = create.json().id;

    const reject = await app.inject({
      method: "POST",
      url: `/api/admin/edits/${editId}/reject`,
      headers: { authorization: ADMIN_BEARER },
      payload: { reason: "doesn't match the source" },
    });
    expect(reject.statusCode).toBe(200);

    const after = await db.query.conferences.findFirst({
      where: eq(conferences.id, target.id),
    });
    expect(after?.name).toBe("Original");
  });
});

describe("invites", () => {
  it("admin can create an invite", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/invites",
      headers: { authorization: ADMIN_BEARER },
      payload: { githubLogin: "newcomer" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().githubLogin).toBe("newcomer");
  });

  it("rejects invalid github usernames", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/invites",
      headers: { authorization: ADMIN_BEARER },
      payload: { githubLogin: "not a valid username!" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("blocks duplicate pending invites for the same login", async () => {
    await app.inject({
      method: "POST",
      url: "/api/admin/invites",
      headers: { authorization: ADMIN_BEARER },
      payload: { githubLogin: "twice" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/invites",
      headers: { authorization: ADMIN_BEARER },
      payload: { githubLogin: "twice" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("already invited");
  });
});
