import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db/client.js";
import {
  conferences,
  conferenceEdits,
  invites,
  sessions,
  users,
} from "../src/db/schema.js";

const tables = [conferenceEdits, sessions, invites, users, conferences];

export async function truncateAll(): Promise<void> {
  for (const t of tables) {
    await db.execute(sql`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`);
  }
}

export async function buildTestApp(): Promise<FastifyInstance> {
  return buildApp({ logger: false, rateLimit: false });
}

export const ADMIN_BEARER = `Bearer ${process.env.ADMIN_TOKEN}`;

export async function insertApprovedConference(
  overrides: Partial<typeof conferences.$inferInsert> = {},
) {
  const [row] = await db
    .insert(conferences)
    .values({
      slug: overrides.slug ?? "test-conf-jan-2027",
      name: overrides.name ?? "Test Conf",
      website: overrides.website ?? "https://test.example",
      location: overrides.location ?? "Berlin",
      online: overrides.online ?? false,
      dateStart: overrides.dateStart ?? "2027-01-10",
      dateEnd: overrides.dateEnd ?? "2027-01-12",
      moderationStatus: "approved",
      ...overrides,
    })
    .returning();
  return row!;
}

export async function insertUser(
  overrides: Partial<typeof users.$inferInsert> = {},
) {
  const [row] = await db
    .insert(users)
    .values({
      githubId: overrides.githubId ?? Math.floor(Math.random() * 1_000_000_000),
      githubLogin: overrides.githubLogin ?? `user${Date.now()}`,
      name: overrides.name ?? null,
      email: overrides.email ?? null,
      avatarUrl: overrides.avatarUrl ?? null,
      isAdmin: overrides.isAdmin ?? false,
      ...overrides,
    })
    .returning();
  return row!;
}

export async function insertSession(userId: string): Promise<string> {
  const id = `sess-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return id;
}
