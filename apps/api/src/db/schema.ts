import {
  pgTable,
  uuid,
  text,
  boolean,
  date,
  timestamp,
  bigint,
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

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  githubLogin: text("github_login").notNull().unique(),
  email: text("email"),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubLogin: text("github_login").notNull().unique(),
  invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
});

export type InviteRow = typeof invites.$inferSelect;

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionsUserIdx: index("sessions_user_idx").on(t.userId),
  }),
);

export type SessionRow = typeof sessions.$inferSelect;
