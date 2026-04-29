import { useState } from "react";
import { ConferenceForm } from "../components/ConferenceForm";
import { submitConference } from "../api";

export function SuggestPage() {
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-emerald-900">
        Thanks! Your suggestion was submitted and is awaiting review.
        <button
          className="ml-3 underline"
          onClick={() => setDone(false)}
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Suggest a conference</h2>
      <p className="text-sm text-slate-600 mb-4">
        New suggestions are reviewed before appearing publicly.
      </p>
      <ConferenceForm
        submitLabel="Submit suggestion"
        showSubmitterFields
        onSubmit={async (input, extras) => {
          await submitConference({
            ...input,
            submitterName: extras.submitterName ?? null,
            submitterEmail: extras.submitterEmail ?? null,
            submissionNote: extras.submissionNote ?? null,
            website_confirm: extras.honeypot,
          });
          setDone(true);
        }}
      />
    </div>
  );
}
