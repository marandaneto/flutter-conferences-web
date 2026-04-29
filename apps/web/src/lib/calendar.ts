import type { Conference } from "@fc/shared";

function compactDate(isoDate: string): string {
  return isoDate.replaceAll("-", "");
}

function addOneDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function summary(c: Conference): string {
  return c.location ? `${c.name} (${c.location})` : c.name;
}

export function googleCalendarUrl(c: Conference): string {
  const start = compactDate(c.dateStart);
  // Google treats DTEND as exclusive for all-day events.
  const end = compactDate(addOneDay(c.dateEnd));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: summary(c),
    dates: `${start}/${end}`,
    details: c.website,
    location: c.location ?? "",
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

function escapeIcs(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;")
    .replaceAll("\n", "\\n");
}

function nowDtStamp(): string {
  // YYYYMMDDTHHMMSSZ
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function buildIcs(c: Conference): string {
  const start = compactDate(c.dateStart);
  const end = compactDate(addOneDay(c.dateEnd));
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:flutterconferences.com",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${c.slug}@flutterconferences.com`,
    `SUMMARY:${escapeIcs(summary(c))}`,
    `DESCRIPTION:${escapeIcs(c.website)}`,
    `URL:${c.website}`,
    `LOCATION:${escapeIcs(c.location ?? "")}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `DTSTAMP:${nowDtStamp()}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function icsDataUrl(c: Conference): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(c))}`;
}

export function icsFilename(c: Conference): string {
  return `${c.slug}.ics`;
}
