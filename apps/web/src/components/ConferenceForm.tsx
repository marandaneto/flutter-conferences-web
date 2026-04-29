import { useState } from "react";
import {
  conferenceInputSchema,
  EVENT_STATUSES,
  type ConferenceInput,
} from "@fc/shared";

export type ConferenceFormProps = {
  initial?: Partial<ConferenceInput>;
  submitLabel: string;
  showNote?: boolean;
  onSubmit: (input: ConferenceInput, extras: SubmitterExtras) => Promise<void>;
};

export type SubmitterExtras = {
  submissionNote?: string;
};

const inputClass =
  "w-full border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function ConferenceForm({
  initial,
  submitLabel,
  showNote,
  onSubmit,
}: ConferenceFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [online, setOnline] = useState(initial?.online ?? false);
  const [eventStatus, setEventStatus] = useState<string>(
    initial?.eventStatus ?? "",
  );
  const [dateStart, setDateStart] = useState(initial?.dateStart ?? "");
  const [dateEnd, setDateEnd] = useState(initial?.dateEnd ?? "");

  const [hasCfp, setHasCfp] = useState(!!initial?.cfp);
  const [cfpStart, setCfpStart] = useState(initial?.cfp?.start ?? "");
  const [cfpEnd, setCfpEnd] = useState(initial?.cfp?.end ?? "");
  const [cfpSite, setCfpSite] = useState(initial?.cfp?.site ?? "");

  const [submissionNote, setSubmissionNote] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const candidate = {
      name,
      website: normalizeUrl(website),
      location,
      online,
      eventStatus: eventStatus || null,
      dateStart,
      dateEnd,
      cfp: hasCfp
        ? {
            start: cfpStart,
            end: cfpEnd,
            site: cfpSite ? normalizeUrl(cfpSite) : null,
          }
        : null,
    };

    const parsed = conferenceInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      return;
    }

    setPending(true);
    try {
      await onSubmit(parsed.data, {
        submissionNote: submissionNote || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Name</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <label className={labelClass}>Website</label>
        <input
          className={inputClass}
          type="text"
          inputMode="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="example.com or https://example.com"
          required
        />
      </div>
      <div>
        <label className={labelClass}>Location</label>
        <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Start date</label>
          <input className={inputClass} type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>End date</label>
          <input className={inputClass} type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} required />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input id="online" type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} />
        <label htmlFor="online" className="text-sm">Online-only event</label>
      </div>
      <div>
        <label className={labelClass}>Event status (optional)</label>
        <select className={inputClass} value={eventStatus} onChange={(e) => setEventStatus(e.target.value)}>
          <option value="">—</option>
          {EVENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <fieldset className="border border-slate-200 rounded-md p-3">
        <legend className="text-sm px-1">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hasCfp} onChange={(e) => setHasCfp(e.target.checked)} />
            Has Call For Papers
          </label>
        </legend>
        {hasCfp && (
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>CFP start</label>
                <input className={inputClass} type="date" value={cfpStart} onChange={(e) => setCfpStart(e.target.value)} required />
              </div>
              <div>
                <label className={labelClass}>CFP end</label>
                <input className={inputClass} type="date" value={cfpEnd} onChange={(e) => setCfpEnd(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className={labelClass}>CFP site (optional)</label>
              <input
                className={inputClass}
                type="text"
                inputMode="url"
                value={cfpSite}
                onChange={(e) => setCfpSite(e.target.value)}
                placeholder="example.com or https://example.com"
              />
            </div>
          </div>
        )}
      </fieldset>

      {showNote && (
        <div>
          <label className={labelClass}>Note (anything we should know)</label>
          <textarea
            className={inputClass}
            rows={3}
            value={submissionNote}
            onChange={(e) => setSubmissionNote(e.target.value)}
            placeholder="Optional context for the reviewer"
          />
        </div>
      )}

      {error && <p className="text-sm text-rose-700">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 bg-slate-900 text-white rounded-md disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
