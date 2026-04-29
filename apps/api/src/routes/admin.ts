import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  conferenceInputSchema,
  conferencePatchSchema,
  rejectInputSchema,
  MODERATION_STATUSES,
  type ModerationStatus,
} from "@fc/shared";
import { db } from "../db/client.js";
import { conferences, invites, users } from "../db/schema.js";
import { makeSlug } from "../lib/slug.js";
import { rowToConference } from "../lib/serialize.js";
import { resolveAuth } from "../lib/auth.js";

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    const auth = await resolveAuth(req);
    if (auth.kind === "none") {
      return reply.code(401).send({ error: "unauthorized" });
    }
    (req as any).auth = auth;
  });

  app.get("/api/admin/conferences", async (req) => {
    const status = (req.query as { status?: string }).status as
      | ModerationStatus
      | undefined;
    const where =
      status && MODERATION_STATUSES.includes(status)
        ? eq(conferences.moderationStatus, status)
        : undefined;
    const rows = await db
      .select()
      .from(conferences)
      .where(where!)
      .orderBy(desc(conferences.createdAt));
    return rows.map(rowToConference);
  });

  app.post("/api/admin/conferences", async (req, reply) => {
    const parsed = conferenceInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ issues: parsed.error.flatten() });
    }
    const d = parsed.data;
    const slug = await uniqueSlug(makeSlug(d.name, d.dateStart));
    const [row] = await db
      .insert(conferences)
      .values({
        slug,
        name: d.name,
        website: d.website,
        location: d.location,
        online: d.online,
        eventStatus: d.eventStatus ?? null,
        dateStart: d.dateStart,
        dateEnd: d.dateEnd,
        cfpStart: d.cfp?.start ?? null,
        cfpEnd: d.cfp?.end ?? null,
        cfpSite: d.cfp?.site ?? null,
        moderationStatus: "approved",
        reviewedAt: new Date(),
      })
      .returning();
    return reply.code(201).send(rowToConference(row!));
  });

  app.patch("/api/admin/conferences/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = conferencePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ issues: parsed.error.flatten() });
    }
    const d = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (d.name !== undefined) patch.name = d.name;
    if (d.website !== undefined) patch.website = d.website;
    if (d.location !== undefined) patch.location = d.location;
    if (d.online !== undefined) patch.online = d.online;
    if (d.eventStatus !== undefined) patch.eventStatus = d.eventStatus;
    if (d.dateStart !== undefined) patch.dateStart = d.dateStart;
    if (d.dateEnd !== undefined) patch.dateEnd = d.dateEnd;
    if (d.cfp !== undefined) {
      patch.cfpStart = d.cfp?.start ?? null;
      patch.cfpEnd = d.cfp?.end ?? null;
      patch.cfpSite = d.cfp?.site ?? null;
    }
    const [row] = await db
      .update(conferences)
      .set(patch)
      .where(eq(conferences.id, id))
      .returning();
    if (!row) return reply.code(404).send({ error: "not found" });
    return rowToConference(row);
  });

  app.post("/api/admin/conferences/:id/approve", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db
      .update(conferences)
      .set({
        moderationStatus: "approved",
        reviewedAt: new Date(),
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(conferences.id, id))
      .returning();
    if (!row) return reply.code(404).send({ error: "not found" });
    return rowToConference(row);
  });

  app.post("/api/admin/conferences/:id/reject", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = rejectInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ issues: parsed.error.flatten() });
    }
    const [row] = await db
      .update(conferences)
      .set({
        moderationStatus: "rejected",
        rejectionReason: parsed.data.reason,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conferences.id, id))
      .returning();
    if (!row) return reply.code(404).send({ error: "not found" });
    return rowToConference(row);
  });

  app.delete("/api/admin/conferences/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db
      .delete(conferences)
      .where(eq(conferences.id, id))
      .returning({ id: conferences.id });
    if (!row) return reply.code(404).send({ error: "not found" });
    return reply.code(204).send();
  });

  app.get("/api/admin/members", async () => {
    const rows = await db
      .select()
      .from(users)
      .orderBy(asc(users.githubLogin));
    return rows.map((u) => ({
      id: u.id,
      githubLogin: u.githubLogin,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt.toISOString(),
    }));
  });

  app.delete("/api/admin/members/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id, githubLogin: users.githubLogin });
    if (!row) return reply.code(404).send({ error: "not found" });
    // Drop the historical invite so they can be re-invited later.
    await db.delete(invites).where(eq(invites.githubLogin, row.githubLogin));
    return reply.code(204).send();
  });

  app.get("/api/admin/invites", async () => {
    const rows = await db
      .select()
      .from(invites)
      .where(isNull(invites.acceptedAt))
      .orderBy(desc(invites.createdAt));
    return rows.map((i) => ({
      id: i.id,
      githubLogin: i.githubLogin,
      createdAt: i.createdAt.toISOString(),
      acceptedAt: i.acceptedAt ? i.acceptedAt.toISOString() : null,
    }));
  });

  const inviteSchema = z.object({
    githubLogin: z
      .string()
      .min(1)
      .max(40)
      .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/, {
        message: "invalid github username",
      }),
  });

  app.post("/api/admin/invites", async (req, reply) => {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ issues: parsed.error.flatten() });
    }
    const login = parsed.data.githubLogin;

    const existingUser = await db.query.users.findFirst({
      where: eq(users.githubLogin, login),
    });
    if (existingUser) {
      return reply.code(409).send({ error: "already a member" });
    }
    const existingInvite = await db.query.invites.findFirst({
      where: eq(invites.githubLogin, login),
    });
    if (existingInvite) {
      if (!existingInvite.acceptedAt) {
        return reply.code(409).send({ error: "already invited" });
      }
      // Previously accepted invite, but the user no longer exists.
      // Clear it so we can issue a fresh invite.
      await db.delete(invites).where(eq(invites.id, existingInvite.id));
    }

    const auth = (req as any).auth;
    const invitedBy = auth?.kind === "user" ? auth.user.id : null;
    const [row] = await db
      .insert(invites)
      .values({ githubLogin: login, invitedBy })
      .returning();
    return reply.code(201).send({
      id: row!.id,
      githubLogin: row!.githubLogin,
      createdAt: row!.createdAt.toISOString(),
      acceptedAt: null,
    });
  });

  app.delete("/api/admin/invites/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db
      .delete(invites)
      .where(eq(invites.id, id))
      .returning({ id: invites.id });
    if (!row) return reply.code(404).send({ error: "not found" });
    return reply.code(204).send();
  });
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  while (true) {
    const existing = await db.query.conferences.findFirst({
      where: (c, { eq }) => eq(c.slug, candidate),
      columns: { id: true },
    });
    if (!existing) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}
