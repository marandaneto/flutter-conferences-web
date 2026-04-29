import type { FastifyInstance } from "fastify";
import { submissionInputSchema } from "@fc/shared";
import { db } from "../db/client.js";
import { conferences } from "../db/schema.js";
import { makeSlug } from "../lib/slug.js";
import { rowToConference } from "../lib/serialize.js";

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
      const parsed = submissionInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "invalid",
          issues: parsed.error.flatten(),
        });
      }
      const data = parsed.data;

      // Honeypot trip — pretend to succeed so bots don't retry.
      if (data.website_confirm && data.website_confirm.length > 0) {
        return reply.code(202).send({ ok: true });
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
          submitterName: data.submitterName ?? null,
          submitterEmail: data.submitterEmail ?? null,
          submissionNote: data.submissionNote ?? null,
          moderationStatus: "pending",
        })
        .returning();

      return reply.code(201).send(rowToConference(row!));
    },
  );
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
