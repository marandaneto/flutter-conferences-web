import type { FastifyInstance } from "fastify";
import { and, eq, gte, ilike, inArray, lte, or } from "drizzle-orm";
import { conferenceInputSchema } from "@fc/shared";
import { z } from "zod";
import { db } from "../db/client.js";
import { conferences } from "../db/schema.js";
import { makeSlug } from "../lib/slug.js";
import { rowToConference } from "../lib/serialize.js";
import { resolveAuth } from "../lib/auth.js";
import { sendNotification, escapeHtml } from "../lib/email.js";
import { env } from "../env.js";

const submissionBodySchema = conferenceInputSchema.and(
  z.object({
    submissionNote: z.string().max(2000).optional().nullable(),
  }),
);

export async function submissionRoutes(app: FastifyInstance) {
  app.post(
    "/api/submissions",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 hour",
        },
      },
    },
    async (req, reply) => {
      const auth = await resolveAuth(req);
      if (auth.kind !== "user") {
        return reply.code(401).send({ error: "sign in to submit" });
      }

      const parsed = submissionBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "invalid",
          issues: parsed.error.flatten(),
        });
      }
      const data = parsed.data;
      const submitter = auth.user;

      const duplicate = await findDuplicate(data);
      if (duplicate) {
        return reply.code(409).send(duplicateError(duplicate));
      }

      const slug = await uniqueSlug(makeSlug(data.name, data.dateStart));

      const [row] = await db
        .insert(conferences)
        .values({
          slug,
          name: data.name,
          website: data.website,
          location: data.location,
          online: data.online,
          eventStatus: data.eventStatus ?? null,
          dateStart: data.dateStart,
          dateEnd: data.dateEnd,
          cfpStart: data.cfp?.start ?? null,
          cfpEnd: data.cfp?.end ?? null,
          cfpSite: data.cfp?.site ?? null,
          submitterName: submitter.name ?? `@${submitter.githubLogin}`,
          submitterEmail: submitter.email,
          submissionNote: data.submissionNote ?? null,
          moderationStatus: "pending",
        })
        .returning();

      // Fire-and-forget: don't fail the API call on email problems.
      void notifyAdmins(req.log, row!, submitter);

      return reply.code(201).send(rowToConference(row!));
    },
  );
}

async function notifyAdmins(
  log: { error: (...args: unknown[]) => void },
  row: typeof conferences.$inferSelect,
  submitter: { githubLogin: string; name: string | null; email: string | null },
) {
  const adminUrl = `${env.WEB_URL.replace(/\/$/, "")}/admin`;
  const cfp =
    row.cfpStart && row.cfpEnd
      ? `${row.cfpStart} → ${row.cfpEnd}${row.cfpSite ? ` (${row.cfpSite})` : ""}`
      : "—";
  const subject = `[Flutter Conferences] New suggestion: ${row.name}`;
  const text = [
    `New conference suggestion pending review.`,
    ``,
    `Name:     ${row.name}`,
    `Website:  ${row.website}`,
    `Location: ${row.location}${row.online ? " (online)" : ""}`,
    `Dates:    ${row.dateStart} → ${row.dateEnd}`,
    `CFP:      ${cfp}`,
    ``,
    `Submitted by: @${submitter.githubLogin}${submitter.name ? ` (${submitter.name})` : ""}${submitter.email ? ` <${submitter.email}>` : ""}`,
    row.submissionNote ? `Note: ${row.submissionNote}` : "",
    ``,
    `Review: ${adminUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <p>New conference suggestion pending review.</p>
    <table style="border-collapse:collapse">
      <tr><td><strong>Name</strong></td><td>${escapeHtml(row.name)}</td></tr>
      <tr><td><strong>Website</strong></td><td><a href="${escapeHtml(row.website)}">${escapeHtml(row.website)}</a></td></tr>
      <tr><td><strong>Location</strong></td><td>${escapeHtml(row.location)}${row.online ? " (online)" : ""}</td></tr>
      <tr><td><strong>Dates</strong></td><td>${row.dateStart} → ${row.dateEnd}</td></tr>
      <tr><td><strong>CFP</strong></td><td>${escapeHtml(cfp)}</td></tr>
      <tr><td><strong>Submitter</strong></td><td>@${escapeHtml(submitter.githubLogin)}${submitter.name ? ` (${escapeHtml(submitter.name)})` : ""}${submitter.email ? ` &lt;${escapeHtml(submitter.email)}&gt;` : ""}</td></tr>
      ${row.submissionNote ? `<tr><td><strong>Note</strong></td><td>${escapeHtml(row.submissionNote)}</td></tr>` : ""}
    </table>
    <p><a href="${adminUrl}">Review in admin</a></p>
  `;

  await sendNotification(log, { subject, html, text });
}

export async function findDuplicate(input: {
  name: string;
  website: string;
  dateStart: string;
  dateEnd: string;
}) {
  return db.query.conferences.findFirst({
    where: and(
      inArray(conferences.moderationStatus, ["pending", "approved"]),
      or(
        ilike(conferences.name, input.name),
        eq(conferences.website, input.website),
      ),
      lte(conferences.dateStart, input.dateEnd),
      gte(conferences.dateEnd, input.dateStart),
    ),
  });
}

export function duplicateError(duplicate: typeof conferences.$inferSelect) {
  const stateLabel =
    duplicate.moderationStatus === "approved"
      ? "already listed"
      : "awaiting review";
  return {
    error: "duplicate" as const,
    message: `"${duplicate.name}" (${duplicate.dateStart} → ${duplicate.dateEnd}) is ${stateLabel}.`,
    existing: {
      id: duplicate.id,
      name: duplicate.name,
      dateStart: duplicate.dateStart,
      dateEnd: duplicate.dateEnd,
      moderationStatus: duplicate.moderationStatus,
    },
  };
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
