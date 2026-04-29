import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
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

const validBody = {
  name: "Brand New Conf",
  website: "https://brand-new-conf.example",
  location: "Lisbon",
  online: false,
  dateStart: "2027-05-10",
  dateEnd: "2027-05-12",
};

describe("POST /api/submissions", () => {
  it("rejects unauthenticated submissions with 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/submissions",
      payload: validBody,
    });
    expect(res.statusCode).toBe(401);
  });

  it("creates a pending submission for a signed-in user", async () => {
    const user = await insertUser({
      githubLogin: "submitter",
      name: "Sue Submitter",
      email: "sue@example.com",
    });
    const sid = await insertSession(user.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/submissions",
      cookies: { fc_session: sid },
      payload: validBody,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.moderationStatus).toBe("pending");
    expect(body.name).toBe(validBody.name);
    expect(body.submitterName).toBe("Sue Submitter");
    expect(body.submitterEmail).toBe("sue@example.com");
  });

  it("falls back to @login when the user has no name", async () => {
    const user = await insertUser({
      githubLogin: "no-name",
      name: null,
      email: null,
    });
    const sid = await insertSession(user.id);
    const res = await app.inject({
      method: "POST",
      url: "/api/submissions",
      cookies: { fc_session: sid },
      payload: validBody,
    });
    const body = res.json();
    expect(body.submitterName).toBe("@no-name");
  });

  it("rejects duplicate by name + overlapping dates with 409", async () => {
    await insertApprovedConference({
      slug: "existing",
      name: "Brand New Conf",
      website: "https://other.example",
      dateStart: "2027-05-11",
      dateEnd: "2027-05-13",
    });

    const user = await insertUser();
    const sid = await insertSession(user.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/submissions",
      cookies: { fc_session: sid },
      payload: validBody,
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("duplicate");
  });

  it("rejects duplicate by website + overlapping dates with 409", async () => {
    await insertApprovedConference({
      slug: "existing-by-url",
      name: "Different Name",
      website: validBody.website,
      dateStart: "2027-05-09",
      dateEnd: "2027-05-11",
    });

    const user = await insertUser();
    const sid = await insertSession(user.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/submissions",
      cookies: { fc_session: sid },
      payload: validBody,
    });
    expect(res.statusCode).toBe(409);
  });

  it("ignores rejected siblings as duplicates", async () => {
    await insertApprovedConference({
      slug: "rejected-twin",
      name: "Brand New Conf",
      moderationStatus: "rejected",
      dateStart: "2027-05-10",
      dateEnd: "2027-05-12",
    });

    const user = await insertUser();
    const sid = await insertSession(user.id);

    const res = await app.inject({
      method: "POST",
      url: "/api/submissions",
      cookies: { fc_session: sid },
      payload: validBody,
    });
    expect(res.statusCode).toBe(201);
  });
});

describe("GET /api/conferences", () => {
  it("returns only approved conferences and respects upcoming filter", async () => {
    await insertApprovedConference({
      slug: "upcoming",
      name: "Upcoming",
      dateStart: "2099-01-01",
      dateEnd: "2099-01-02",
    });
    await insertApprovedConference({
      slug: "past",
      name: "Past",
      dateStart: "2000-01-01",
      dateEnd: "2000-01-02",
    });
    await insertApprovedConference({
      slug: "pending-thing",
      name: "Pending",
      moderationStatus: "pending",
      dateStart: "2099-02-01",
      dateEnd: "2099-02-02",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/conferences?filter=upcoming",
    });
    const body = res.json();
    expect(body.map((c: { slug: string }) => c.slug)).toEqual(["upcoming"]);
  });
});
