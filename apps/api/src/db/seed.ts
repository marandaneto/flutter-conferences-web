import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import matter from "gray-matter";
import { sql } from "drizzle-orm";
import { db } from "./client.js";
import { conferences } from "./schema.js";

const SOURCE_DIR = process.env.SEED_SOURCE_DIR
  ?? join(process.cwd(), "..", "..", "..", "flutter-conferences", "_conferences");

function toIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  throw new Error(`bad date: ${String(value)}`);
}

function slugFromFilename(filename: string): string {
  return basename(filename, ".md");
}

const files = await readdir(SOURCE_DIR);
const mdFiles = files.filter((f) => f.endsWith(".md"));

console.log(`importing ${mdFiles.length} conferences from ${SOURCE_DIR}`);

let inserted = 0;
let skipped = 0;

for (const file of mdFiles) {
  const raw = await readFile(join(SOURCE_DIR, file), "utf8");
  const { data } = matter(raw);
  const slug = slugFromFilename(file);

  const row = {
    slug,
    name: String(data.name),
    website: String(data.website),
    location: String(data.location ?? ""),
    online: Boolean(data.online),
    eventStatus: data.status ? String(data.status) : null,
    dateStart: toIsoDate(data.date_start),
    dateEnd: toIsoDate(data.date_end),
    cfpStart: data.cfp?.start ? toIsoDate(data.cfp.start) : null,
    cfpEnd: data.cfp?.end ? toIsoDate(data.cfp.end) : null,
    cfpSite: data.cfp?.site ? String(data.cfp.site) : null,
    moderationStatus: "approved" as const,
  };

  const result = await db
    .insert(conferences)
    .values(row)
    .onConflictDoNothing({ target: conferences.slug })
    .returning({ id: conferences.id });

  if (result.length > 0) inserted++;
  else skipped++;
}

console.log(`done. inserted=${inserted} skipped=${skipped}`);
await db.execute(sql`select 1`);
process.exit(0);
