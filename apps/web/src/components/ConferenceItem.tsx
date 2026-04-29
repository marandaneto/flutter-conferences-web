import {
  type Conference,
  cfpIsOpen,
  isHappeningNow,
  todayMidnight,
  dateAtMidnight,
} from "@fc/shared";

const badge = "inline-block ml-2 px-2 py-0.5 text-xs rounded";

export function ConferenceItem({ c }: { c: Conference }) {
  const isPast = todayMidnight() > dateAtMidnight(c.dateEnd);
  const happening = isHappeningNow(c);
  const showCfp = cfpIsOpen(c);

  return (
    <li className={`py-2 ${isPast ? "text-slate-400" : ""}`}>
      <span className="tabular-nums text-sm text-slate-600">{c.dateStart}</span>{" "}
      <a
        className="text-sky-700 hover:underline font-medium"
        href={c.website}
        target="_blank"
        rel="noreferrer"
      >
        {c.name}
      </a>
      {c.location && (
        <span className="text-sm text-slate-500"> {c.location}</span>
      )}
      {showCfp && c.cfp && (
        <a
          className={`${badge} bg-sky-100 text-sky-800 hover:bg-sky-200`}
          href={c.cfp.site ?? c.website}
          target="_blank"
          rel="noreferrer"
        >
          Call For Papers until {c.cfp.end}
        </a>
      )}
      {c.eventStatus && (
        <span className={`${badge} bg-rose-100 text-rose-800`}>
          {c.eventStatus}
        </span>
      )}
      {c.online && (
        <span className={`${badge} bg-indigo-100 text-indigo-800`}>
          Online-only event
        </span>
      )}
      {happening && (
        <span className={`${badge} bg-emerald-100 text-emerald-800`}>
          Happening Now
        </span>
      )}
    </li>
  );
}
