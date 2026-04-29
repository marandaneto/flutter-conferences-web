import { z } from "zod";

export const EVENT_STATUSES = ["Canceled", "Postponed"] as const;
export const MODERATION_STATUSES = ["pending", "approved", "rejected"] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

const httpUrl = z
  .string()
  .regex(/^https?:\/\//, "must start with http:// or https://");

export const cfpSchema = z
  .object({
    start: isoDate,
    end: isoDate,
    site: httpUrl.optional().nullable(),
  })
  .refine((c) => c.start <= c.end, {
    message: "cfp.start must be on or before cfp.end",
    path: ["end"],
  });

export const conferenceObjectSchema = z.object({
  name: z.string().min(1).max(200),
  website: httpUrl,
  location: z.string().min(1).max(200),
  online: z.boolean().default(false),
  eventStatus: z.enum(EVENT_STATUSES).optional().nullable(),
  dateStart: isoDate,
  dateEnd: isoDate,
  cfp: cfpSchema.optional().nullable(),
});

export const conferenceInputSchema = conferenceObjectSchema.refine(
  (c) => c.dateStart <= c.dateEnd,
  {
    message: "dateStart must be on or before dateEnd",
    path: ["dateEnd"],
  },
);

export const conferencePatchSchema = conferenceObjectSchema.partial();

export type ConferenceInput = z.infer<typeof conferenceInputSchema>;

export const submissionInputSchema = conferenceInputSchema.and(
  z.object({
    submitterName: z.string().max(120).optional().nullable(),
    submitterEmail: z.string().email().max(200).optional().nullable(),
    submissionNote: z.string().max(2000).optional().nullable(),
    // Honeypot: bots fill all visible inputs. Validated server-side by checking it's empty.
    website_confirm: z.string().optional().default(""),
  }),
);

export type SubmissionInput = z.infer<typeof submissionInputSchema>;

export const conferenceSchema = conferenceInputSchema.and(
  z.object({
    id: z.string().uuid(),
    slug: z.string(),
    moderationStatus: z.enum(MODERATION_STATUSES),
    submitterName: z.string().nullable(),
    submitterEmail: z.string().nullable(),
    submissionNote: z.string().nullable(),
    rejectionReason: z.string().nullable(),
    reviewedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);

export type Conference = z.infer<typeof conferenceSchema>;

export const rejectInputSchema = z.object({
  reason: z.string().min(1).max(500),
});

export type RejectInput = z.infer<typeof rejectInputSchema>;

export function dateAtMidnight(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function todayMidnight(): number {
  return dateAtMidnight(new Date());
}

export function isUpcoming(c: Pick<Conference, "dateEnd">): boolean {
  return todayMidnight() <= dateAtMidnight(c.dateEnd);
}

export function isHappeningNow(
  c: Pick<Conference, "dateStart" | "dateEnd">,
): boolean {
  const t = todayMidnight();
  return t >= dateAtMidnight(c.dateStart) && t <= dateAtMidnight(c.dateEnd);
}

export function cfpIsOpen(
  c: Pick<Conference, "cfp">,
): boolean {
  if (!c.cfp) return false;
  const t = todayMidnight();
  return t >= dateAtMidnight(c.cfp.start) && t <= dateAtMidnight(c.cfp.end);
}
