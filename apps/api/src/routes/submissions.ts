import type { FastifyInstance } from "fastify";
import { conferenceInputSchema } from "@fc/shared";
import { z } from "zod";
import { db } from "../db/client.js";
import { conferences } from "../db/schema.js";
import { makeSlug } from "../lib/slug.js";
import { rowToConference } from "../lib/serialize.js";
import { resolveAuth } from "../lib/auth.js";

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
          submitterName:
            submitter.name ?? `@${submitter.githubLogin}`,
          submitterEmail: submitter.email,
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
