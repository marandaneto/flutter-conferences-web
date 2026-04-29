import type { ConferenceRow } from "../db/schema.js";
import type { Conference } from "@fc/shared";

export function rowToConference(row: ConferenceRow): Conference {
  const cfp =
    row.cfpStart && row.cfpEnd
      ? { start: row.cfpStart, end: row.cfpEnd, site: row.cfpSite }
      : null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    website: row.website,
    location: row.location,
    online: row.online,
    eventStatus: (row.eventStatus as Conference["eventStatus"]) ?? null,
    dateStart: row.dateStart,
    dateEnd: row.dateEnd,
    cfp,
    moderationStatus: row.moderationStatus as Conference["moderationStatus"],
    submitterName: row.submitterName,
    submitterEmail: row.submitterEmail,
    submissionNote: row.submissionNote,
    rejectionReason: row.rejectionReason,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
