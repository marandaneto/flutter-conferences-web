import { useMemo, useState } from "react";
import type { Conference } from "@fc/shared";
import { ConferenceItem } from "./ConferenceItem";

type Props = {
  conferences: Conference[];
  showOnlineToggle?: boolean;
  showYearFilter?: boolean;
};

export function ConferenceList({
  conferences,
  showOnlineToggle,
  showYearFilter,
}: Props) {
  const [query, setQuery] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [year, setYear] = useState<string>("all");

  const years = useMemo(() => {
    if (!showYearFilter) return [];
    const all = new Set<string>();
    for (const c of conferences) all.add(c.dateStart.slice(0, 4));
    return [...all].sort().reverse();
  }, [conferences, showYearFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conferences.filter((c) => {
      if (q) {
        const haystack = `${c.name} ${c.location}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (onlineOnly && !c.online) return false;
      if (year !== "all" && c.dateStart.slice(0, 4) !== year) return false;
      return true;
    });
  }, [conferences, query, onlineOnly, year]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or location…"
          className="flex-1 min-w-[200px] border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        {showOnlineToggle && (
          <label className="flex items-center gap-1.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={onlineOnly}
              onChange={(e) => setOnlineOnly(e.target.checked)}
            />
            Online only
          </label>
        )}
        {showYearFilter && years.length > 1 && (
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white"
          >
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No matches.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500 mb-2">
            {filtered.length} of {conferences.length}
          </p>
          <ul className="divide-y divide-slate-200">
            {filtered.map((c) => (
              <ConferenceItem key={c.id} c={c} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
