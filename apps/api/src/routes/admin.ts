import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  conferenceInputSchema,
  conferencePatchSchema,
  rejectInputSchema,
  MODERATION_STATUSES,
  type ModerationStatus,
} from "@fc/shared";
import { db } from "../db/client.js";
import { conferences, conferenceEdits, invites, users } from "../db/schema.js";
import { makeSlug } from "../lib/slug.js";
import { rowToConference } from "../lib/serialize.js";
import { resolveAuth } from "../lib/auth.js";
import { sendEmail, escapeHtml } from "../lib/email.js";
import { env } from "../env.js";
import { findDuplicate, duplicateError } from "./submissions.js";

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    const auth = await resolveAuth(req);
    if (auth.kind === "none") {
      return reply.code(401).send({ error: "unauthorized" });
    }
    if (auth.kind === "user" && !auth.user.isAdmin) {
      return reply.code(403).send({ error: "not an admin" });
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

    const overrideDuplicate =
      (req.query as { overrideDuplicate?: string }).overrideDuplicate === "1";
    if (!overrideDuplicate) {
      const duplicate = await findDuplicate(d);
      if (duplicate) {
        return reply.code(409).send(duplicateError(duplicate));
      }
    }

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
    const previous = await db.query.conferences.findFirst({
      where: eq(conferences.id, id),
    });
    if (!previous) return reply.code(404).send({ error: "not found" });
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
    if (previous.moderationStatus !== "approved") {
      void notifySubmitterApproved(req.log, row);
    }
    return rowToConference(row);
  });

  app.post("/api/admin/conferences/:id/reject", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = rejectInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ issues: parsed.error.flatten() });
    }
    const previous = await db.query.conferences.findFirst({
      where: eq(conferences.id, id),
    });
    if (!previous) return reply.code(404).send({ error: "not found" });
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
    if (previous.moderationStatus !== "rejected") {
      void notifySubmitterRejected(req.log, row);
    }
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
      .where(eq(users.isAdmin, true))
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

  app.get("/api/admin/edits", async (req) => {
    const status = (req.query as { status?: string }).status as
      | ModerationStatus
      | undefined;
    const where =
      status && MODERATION_STATUSES.includes(status)
        ? eq(conferenceEdits.moderationStatus, status)
        : undefined;
    const rows = await db
      .select()
      .from(conferenceEdits)
      .where(where!)
      .orderBy(desc(conferenceEdits.createdAt));

    if (rows.length === 0) return [];

    const conferenceIds = [...new Set(rows.map((r) => r.conferenceId))];
    const submitterIds = [
      ...new Set(rows.map((r) => r.submitterUserId).filter(Boolean) as string[]),
    ];
    const targets = conferenceIds.length
      ? await db
          .select()
          .from(conferences)
          .where(inArray(conferences.id, conferenceIds))
      : [];
    const submitters = submitterIds.length
      ? await db.select().from(users).where(inArray(users.id, submitterIds))
      : [];
    const targetById = new Map(targets.map((t) => [t.id, t]));
    const submitterById = new Map(submitters.map((u) => [u.id, u]));

    return rows.map((edit) => {
      const target = targetById.get(edit.conferenceId);
      const submitter = edit.submitterUserId
        ? submitterById.get(edit.submitterUserId)
        : null;
      return {
        id: edit.id,
        moderationStatus: edit.moderationStatus,
        rejectionReason: edit.rejectionReason,
        submissionNote: edit.submissionNote,
        proposed: edit.proposed,
        createdAt: edit.createdAt.toISOString(),
        reviewedAt: edit.reviewedAt ? edit.reviewedAt.toISOString() : null,
        target: target ? rowToConference(target) : null,
        submitter: submitter
          ? {
              id: submitter.id,
              githubLogin: submitter.githubLogin,
              name: submitter.name,
              email: submitter.email,
              avatarUrl: submitter.avatarUrl,
            }
          : null,
      };
    });
  });

  app.post("/api/admin/edits/:id/approve", async (req, reply) => {
    const { id } = req.params as { id: string };
    const edit = await db.query.conferenceEdits.findFirst({
      where: eq(conferenceEdits.id, id),
    });
    if (!edit) return reply.code(404).send({ error: "not found" });
    if (edit.moderationStatus === "approved") {
      return reply.code(409).send({ error: "already approved" });
    }
    const target = await db.query.conferences.findFirst({
      where: eq(conferences.id, edit.conferenceId),
    });
    if (!target) return reply.code(404).send({ error: "conference gone" });

    const p = edit.proposed;
    await db
      .update(conferences)
      .set({
        name: p.name,
        website: p.website,
        location: p.location,
        online: p.online,
        eventStatus: p.eventStatus ?? null,
        dateStart: p.dateStart,
        dateEnd: p.dateEnd,
        cfpStart: p.cfp?.start ?? null,
        cfpEnd: p.cfp?.end ?? null,
        cfpSite: p.cfp?.site ?? null,
        updatedAt: new Date(),
      })
      .where(eq(conferences.id, target.id));

    const [updatedEdit] = await db
      .update(conferenceEdits)
      .set({
        moderationStatus: "approved",
        reviewedAt: new Date(),
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(conferenceEdits.id, id))
      .returning();

    if (edit.submitterUserId) {
      const submitter = await db.query.users.findFirst({
        where: eq(users.id, edit.submitterUserId),
      });
      if (submitter?.email) {
        void notifyEditApproved(req.log, target.name, submitter);
      }
    }

    return reply.send({ ok: true, edit: updatedEdit });
  });

  app.post("/api/admin/edits/:id/reject", async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = rejectInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ issues: parsed.error.flatten() });
    }
    const edit = await db.query.conferenceEdits.findFirst({
      where: eq(conferenceEdits.id, id),
    });
    if (!edit) return reply.code(404).send({ error: "not found" });
    const [row] = await db
      .update(conferenceEdits)
      .set({
        moderationStatus: "rejected",
        rejectionReason: parsed.data.reason,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conferenceEdits.id, id))
      .returning();
    if (edit.submitterUserId) {
      const submitter = await db.query.users.findFirst({
        where: eq(users.id, edit.submitterUserId),
      });
      if (submitter?.email) {
        const target = await db.query.conferences.findFirst({
          where: eq(conferences.id, edit.conferenceId),
          columns: { name: true },
        });
        if (target) {
          void notifyEditRejected(
            req.log,
            target.name,
            parsed.data.reason,
            submitter,
          );
        }
      }
    }
    return reply.send({ ok: true, edit: row });
  });

  app.delete("/api/admin/edits/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const [row] = await db
      .delete(conferenceEdits)
      .where(eq(conferenceEdits.id, id))
      .returning({ id: conferenceEdits.id });
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

type ConfRow = typeof conferences.$inferSelect;

async function notifySubmitterApproved(
  log: { error: (...args: unknown[]) => void },
  row: ConfRow,
) {
  if (!row.submitterEmail) return;
  const siteUrl = env.WEB_URL.replace(/\/$/, "");
  const subject = `Your suggestion was approved: ${row.name}`;
  const text = [
    `Hi${row.submitterName ? ` ${row.submitterName}` : ""},`,
    ``,
    `Your conference suggestion "${row.name}" has been approved and is now listed publicly.`,
    ``,
    `View it: ${siteUrl}/`,
    ``,
    `Thanks for contributing!`,
  ].join("\n");
  const html = `
    <p>Hi${row.submitterName ? ` ${escapeHtml(row.submitterName)}` : ""},</p>
    <p>Your conference suggestion <strong>${escapeHtml(row.name)}</strong> has been approved and is now listed publicly.</p>
    <p><a href="${siteUrl}/">View the live list</a></p>
    <p>Thanks for contributing!</p>
  `;
  await sendEmail(log, { to: row.submitterEmail, subject, html, text });
}

async function notifyEditApproved(
  log: { error: (...args: unknown[]) => void },
  conferenceName: string,
  submitter: { name: string | null; email: string | null },
) {
  if (!submitter.email) return;
  const siteUrl = env.WEB_URL.replace(/\/$/, "");
  const subject = `Your edit was applied: ${conferenceName}`;
  const text = [
    `Hi${submitter.name ? ` ${submitter.name}` : ""},`,
    ``,
    `Your suggested edit to "${conferenceName}" has been applied.`,
    ``,
    `View it: ${siteUrl}/`,
    ``,
    `Thanks for keeping the list accurate!`,
  ].join("\n");
  const html = `
    <p>Hi${submitter.name ? ` ${escapeHtml(submitter.name)}` : ""},</p>
    <p>Your suggested edit to <strong>${escapeHtml(conferenceName)}</strong> has been applied.</p>
    <p><a href="${siteUrl}/">View the live list</a></p>
    <p>Thanks for keeping the list accurate!</p>
  `;
  await sendEmail(log, { to: submitter.email, subject, html, text });
}

async function notifyEditRejected(
  log: { error: (...args: unknown[]) => void },
  conferenceName: string,
  reason: string,
  submitter: { name: string | null; email: string | null },
) {
  if (!submitter.email) return;
  const subject = `Your edit wasn't applied: ${conferenceName}`;
  const text = [
    `Hi${submitter.name ? ` ${submitter.name}` : ""},`,
    ``,
    `Your suggested edit to "${conferenceName}" was reviewed but not applied.`,
    ``,
    `Reason: ${reason}`,
    ``,
    `Thanks anyway!`,
  ].join("\n");
  const html = `
    <p>Hi${submitter.name ? ` ${escapeHtml(submitter.name)}` : ""},</p>
    <p>Your suggested edit to <strong>${escapeHtml(conferenceName)}</strong> was reviewed but not applied.</p>
    <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    <p>Thanks anyway!</p>
  `;
  await sendEmail(log, { to: submitter.email, subject, html, text });
}

async function notifySubmitterRejected(
  log: { error: (...args: unknown[]) => void },
  row: ConfRow,
) {
  if (!row.submitterEmail) return;
  const siteUrl = env.WEB_URL.replace(/\/$/, "");
  const subject = `Your suggestion wasn't accepted: ${row.name}`;
  const reason = row.rejectionReason ?? "";
  const text = [
    `Hi${row.submitterName ? ` ${row.submitterName}` : ""},`,
    ``,
    `Your conference suggestion "${row.name}" was reviewed but not accepted.`,
    reason ? `\nReason: ${reason}\n` : "",
    `You're welcome to submit a revised suggestion: ${siteUrl}/suggest`,
    ``,
    `Thanks anyway!`,
  ].join("\n");
  const html = `
    <p>Hi${row.submitterName ? ` ${escapeHtml(row.submitterName)}` : ""},</p>
    <p>Your conference suggestion <strong>${escapeHtml(row.name)}</strong> was reviewed but not accepted.</p>
    ${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ""}
    <p>You're welcome to <a href="${siteUrl}/suggest">submit a revised suggestion</a>.</p>
    <p>Thanks anyway!</p>
  `;
  await sendEmail(log, { to: row.submitterEmail, subject, html, text });
}
