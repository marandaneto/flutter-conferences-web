import { describe, it, expect } from "vitest";
import {
  cfpSchema,
  conferenceInputSchema,
  submissionInputSchema,
} from "../src/index.js";

const baseConference = {
  name: "Flutter Friends",
  website: "https://flutterfriends.dev",
  location: "Stockholm, Sweden",
  online: false,
  dateStart: "2026-09-01",
  dateEnd: "2026-09-03",
};

describe("conferenceInputSchema", () => {
  it("accepts a minimal valid conference", () => {
    const result = conferenceInputSchema.safeParse(baseConference);
    expect(result.success).toBe(true);
  });

  it("rejects malformed dates", () => {
    const result = conferenceInputSchema.safeParse({
      ...baseConference,
      dateStart: "2026/09/01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects dateEnd before dateStart", () => {
    const result = conferenceInputSchema.safeParse({
      ...baseConference,
      dateStart: "2026-09-05",
      dateEnd: "2026-09-03",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join(" ");
      expect(message).toMatch(/before/i);
    }
  });

  it("requires http(s) URLs", () => {
    const result = conferenceInputSchema.safeParse({
      ...baseConference,
      website: "flutterfriends.dev",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a CFP with valid date order", () => {
    const result = conferenceInputSchema.safeParse({
      ...baseConference,
      cfp: {
        start: "2026-01-01",
        end: "2026-06-01",
        site: "https://example.com",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a CFP whose end is before its start", () => {
    const result = conferenceInputSchema.safeParse({
      ...baseConference,
      cfp: { start: "2026-06-01", end: "2026-01-01" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown event status", () => {
    const result = conferenceInputSchema.safeParse({
      ...baseConference,
      eventStatus: "Rescheduled",
    });
    expect(result.success).toBe(false);
  });

  it("accepts known event statuses", () => {
    for (const status of ["Canceled", "Postponed"]) {
      const result = conferenceInputSchema.safeParse({
        ...baseConference,
        eventStatus: status,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("cfpSchema", () => {
  it("requires both start and end", () => {
    const result = cfpSchema.safeParse({ start: "2026-01-01" });
    expect(result.success).toBe(false);
  });

  it("allows null/undefined site", () => {
    const result = cfpSchema.safeParse({
      start: "2026-01-01",
      end: "2026-06-01",
    });
    expect(result.success).toBe(true);
  });
});

describe("submissionInputSchema", () => {
  it("accepts a conference with an optional note", () => {
    const result = submissionInputSchema.safeParse({
      ...baseConference,
      submissionNote: "saw it on twitter",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a note exceeding 2000 chars", () => {
    const result = submissionInputSchema.safeParse({
      ...baseConference,
      submissionNote: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
