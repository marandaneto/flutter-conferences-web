import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  type Conference,
  cfpIsOpen,
  isHappeningNow,
  todayMidnight,
  dateAtMidnight,
} from "@fc/shared";
import { getMe, type AuthMe } from "../api";
import { googleCalendarUrl, icsDataUrl, icsFilename } from "../lib/calendar";

const badge = "inline-block px-2 py-0.5 text-xs rounded";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatRange(start: string, end: string): string {
  if (start === end) return formatDate(start);
  const [sy, sm, sd] = start.split("-");
  const [ey, em, ed] = end.split("-");
  if (sy === ey && sm === em) return `${sd}–${ed}.${sm}.${sy}`;
  if (sy === ey) return `${sd}.${sm}–${ed}.${em}.${sy}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function ConferenceItem({ c }: { c: Conference }) {
  const isPast = todayMidnight() > dateAtMidnight(c.dateEnd);
  const happening = isHappeningNow(c);
  const showCfp = cfpIsOpen(c);

  const { data: me } = useQuery<AuthMe>({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
  });
  const canSuggestEdit = me?.authenticated && me.kind === "user";

  const cell = `py-2 border-t border-slate-200 align-baseline ${isPast ? "text-slate-400" : ""}`;

  return (
    <li className="contents">
      <span
        className={`${cell} tabular-nums text-sm text-slate-600 whitespace-nowrap text-right`}
      >
        {formatRange(c.dateStart, c.dateEnd)}
      </span>

      <span className={`${cell} text-right`}>
        <a
          className="text-sky-700 hover:underline font-medium"
          href={c.website}
          target="_blank"
          rel="noreferrer"
        >
          {c.name}
        </a>
        {c.eventStatus && (
          <span className={`${badge} bg-rose-100 text-rose-800 ml-2`}>
            {c.eventStatus}
          </span>
        )}
        {happening && (
          <span className={`${badge} bg-emerald-100 text-emerald-800 ml-2`}>
            Happening Now
          </span>
        )}
      </span>

      <span
        className={`${cell} text-sm text-slate-500 whitespace-nowrap text-right`}
      >
        {c.location}
        {c.online && (
          <span className={`${badge} bg-indigo-100 text-indigo-800 ml-2`}>
            Online
          </span>
        )}
      </span>

      <span className={`${cell} whitespace-nowrap`}>
        {showCfp && c.cfp && (
          <a
            className={`${badge} bg-sky-100 text-sky-800 hover:bg-sky-200`}
            href={c.cfp.site ?? c.website}
            target="_blank"
            rel="noreferrer"
          >
            CFP until {formatDate(c.cfp.end)}
          </a>
        )}
      </span>

      <span className={`${cell} whitespace-nowrap`}>
        {!isPast && (
          <>
            <a
              href={googleCalendarUrl(c)}
              target="_blank"
              rel="noreferrer"
              title="Add to Google Calendar"
              aria-label="Add to Google Calendar"
              className="text-slate-400 hover:text-slate-700"
            >
              📅
            </a>
            <a
              href={icsDataUrl(c)}
              download={icsFilename(c)}
              title="Download .ics for Apple Calendar / Outlook"
              aria-label="Download .ics"
              className="ml-1 text-slate-400 hover:text-slate-700"
            >
              📥
            </a>
          </>
        )}
      </span>

      <span className={`${cell} whitespace-nowrap`}>
        {canSuggestEdit && (
          <Link
            to={`/suggest-edit/${c.slug}`}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Suggest edit
          </Link>
        )}
      </span>
    </li>
  );
}
