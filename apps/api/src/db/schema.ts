import {
  pgTable,
  uuid,
  text,
  boolean,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const conferences = pgTable(
  "conferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    website: text("website").notNull(),
    location: text("location").notNull(),
    online: boolean("online").notNull().default(false),
    eventStatus: text("event_status"),

    dateStart: date("date_start").notNull(),
    dateEnd: date("date_end").notNull(),

    cfpStart: date("cfp_start"),
    cfpEnd: date("cfp_end"),
    cfpSite: text("cfp_site"),

    moderationStatus: text("moderation_status").notNull().default("pending"),
    submitterName: text("submitter_name"),
    submitterEmail: text("submitter_email"),
    submissionNote: text("submission_note"),
    rejectionReason: text("rejection_reason"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    moderationIdx: index("conferences_moderation_idx").on(t.moderationStatus),
    dateEndIdx: index("conferences_date_end_idx").on(t.dateEnd),
  }),
);

export type ConferenceRow = typeof conferences.$inferSelect;
export type ConferenceInsert = typeof conferences.$inferInsert;
