import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { conferenceInputSchema } from "@fc/shared";
import { z } from "zod";
import { db } from "../db/client.js";
import { conferences, conferenceEdits } from "../db/schema.js";
import { resolveAuth } from "../lib/auth.js";
import { sendAdminNotification, escapeHtml } from "../lib/email.js";
import { env } from "../env.js";

const editBodySchema = conferenceInputSchema.and(
  z.object({
    submissionNote: z.string().max(2000).optional().nullable(),
  }),
);

export async function editRoutes(app: FastifyInstance) {
  app.post(
    "/api/conferences/:slug/edits",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 hour",
        },
      },
    },
    async (req, reply) => {
      const auth = await resolveAuth(req);
      if (auth.kind !== "user") {
        return reply.code(401).send({ error: "sign in to suggest edits" });
      }
      const { slug } = req.params as { slug: string };
      const target = await db.query.conferences.findFirst({
        where: and(
          eq(conferences.slug, slug),
          eq(conferences.moderationStatus, "approved"),
        ),
      });
      if (!target) return reply.code(404).send({ error: "not found" });

      const parsed = editBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ issues: parsed.error.flatten() });
      }
      const { submissionNote, ...proposed } = parsed.data;

      const [row] = await db
        .insert(conferenceEdits)
        .values({
          conferenceId: target.id,
          submitterUserId: auth.user.id,
          proposed,
          submissionNote: submissionNote ?? null,
        })
        .returning();

      void notifyAdminsOnEdit(req.log, target, row!, auth.user);

      return reply.code(201).send({
        id: row!.id,
        conferenceId: row!.conferenceId,
        proposed: row!.proposed,
        moderationStatus: row!.moderationStatus,
        createdAt: row!.createdAt.toISOString(),
      });
    },
  );
}

async function notifyAdminsOnEdit(
  log: { error: (...args: unknown[]) => void },
  target: typeof conferences.$inferSelect,
  edit: typeof conferenceEdits.$inferSelect,
  submitter: { githubLogin: string; name: string | null; email: string | null },
) {
  const adminUrl = `${env.WEB_URL.replace(/\/$/, "")}/admin`;
  const proposed = edit.proposed;
  const subject = `[Flutter Conferences] Edit suggested: ${target.name}`;
  const text = [
    `Edit suggested for "${target.name}".`,
    ``,
    `Proposed name:     ${proposed.name}`,
    `Proposed website:  ${proposed.website}`,
    `Proposed location: ${proposed.location}${proposed.online ? " (online)" : ""}`,
    `Proposed dates:    ${proposed.dateStart} → ${proposed.dateEnd}`,
    ``,
    `Submitted by: @${submitter.githubLogin}${submitter.name ? ` (${submitter.name})` : ""}${submitter.email ? ` <${submitter.email}>` : ""}`,
    edit.submissionNote ? `Note: ${edit.submissionNote}` : "",
    ``,
    `Review: ${adminUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  const html = `
    <p>Edit suggested for <strong>${escapeHtml(target.name)}</strong>.</p>
    <p>Submitter: @${escapeHtml(submitter.githubLogin)}${submitter.name ? ` (${escapeHtml(submitter.name)})` : ""}</p>
    ${edit.submissionNote ? `<p><strong>Note:</strong> ${escapeHtml(edit.submissionNote)}</p>` : ""}
    <p><a href="${adminUrl}">Review in admin</a></p>
  `;
  await sendAdminNotification(log, { subject, html, text });
}
