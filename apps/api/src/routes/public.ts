import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { createEvents, type EventAttributes } from "ics";
import { db } from "../db/client.js";
import { conferences } from "../db/schema.js";
import { rowToConference } from "../lib/serialize.js";

const APPROVED = eq(conferences.moderationStatus, "approved");
const today = () => sql`current_date`;

export async function publicRoutes(app: FastifyInstance) {
  app.get("/api/conferences", async (req) => {
    const filter = (req.query as { filter?: string }).filter ?? "upcoming";
    const base = APPROVED;

    let where;
    let order;
    if (filter === "past") {
      where = and(base, lt(conferences.dateEnd, today()));
      order = desc(conferences.dateStart);
    } else if (filter === "online") {
      where = and(
        base,
        gte(conferences.dateEnd, today()),
        eq(conferences.online, true),
      );
      order = asc(conferences.dateStart);
    } else {
      where = and(base, gte(conferences.dateEnd, today()));
      order = asc(conferences.dateStart);
    }

    const rows = await db
      .select()
      .from(conferences)
      .where(where)
      .orderBy(order);
    return rows.map(rowToConference);
  });

  app.get("/api/conferences/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const row = await db.query.conferences.findFirst({
      where: and(eq(conferences.slug, slug), APPROVED),
    });
    if (!row) return reply.code(404).send({ error: "not found" });
    return rowToConference(row);
  });

  app.get("/conferences.ics", async (_req, reply) => {
    const rows = await db
      .select()
      .from(conferences)
      .where(and(APPROVED, sql`${conferences.eventStatus} is null`))
      .orderBy(asc(conferences.dateStart));

    const events: EventAttributes[] = rows.map((r) => {
      const [sy, sm, sd] = r.dateStart.split("-").map(Number) as [
        number,
        number,
        number,
      ];
      const endDate = new Date(r.dateEnd);
      endDate.setDate(endDate.getDate() + 1);
      const ey = endDate.getFullYear();
      const em = endDate.getMonth() + 1;
      const ed = endDate.getDate();
      const summary = r.location ? `${r.name} (${r.location})` : r.name;
      return {
        uid: `${r.slug}@flutterconferences.com`,
        title: summary,
        description: r.website,
        location: r.location ?? undefined,
        url: r.website,
        start: [sy, sm, sd],
        end: [ey, em, ed],
        startInputType: "utc",
        startOutputType: "utc",
        productId: "flutterconferences.com",
      };
    });

    const { error, value } = createEvents(events);
    if (error || !value) {
      reply.code(500);
      return { error: error?.message ?? "ics generation failed" };
    }
    reply.header("content-type", "text/calendar; charset=utf-8");
    return value;
  });
}
