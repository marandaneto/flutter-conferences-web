import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  conferenceInputSchema,
  conferencePatchSchema,
  rejectInputSchema,
  MODERATION_STATUSES,
  type ModerationStatus,
} from "@fc/shared";
import { db } from "../db/client.js";
import { conferences } from "../db/schema.js";
import { makeSlug } from "../lib/slug.js";
import { rowToConference } from "../lib/serialize.js";
import { env } from "../env.js";

function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    reply.code(401).send({ error: "unauthorized" });
    return false;
  }
  return true;
}

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    if (!requireAdmin(req, reply)) return reply;
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
