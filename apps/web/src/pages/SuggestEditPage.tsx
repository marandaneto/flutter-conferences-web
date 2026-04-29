import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ConferenceForm } from "../components/ConferenceForm";
import {
  getConferenceBySlug,
  getMe,
  githubLoginUrl,
  submitEdit,
  type AuthMe,
} from "../api";

export function SuggestEditPage() {
  const { slug } = useParams<{ slug: string }>();
  const [done, setDone] = useState(false);

  const meQuery = useQuery<AuthMe>({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
  });

  const conferenceQuery = useQuery({
    queryKey: ["conference", slug],
    queryFn: () => getConferenceBySlug(slug!),
    enabled: !!slug,
    retry: false,
  });

  if (meQuery.isLoading || conferenceQuery.isLoading) return <p>Loading…</p>;

  const me = meQuery.data;
  const isAuthed = me?.authenticated && me.kind === "user";

  if (!isAuthed) {
    return (
      <div className="max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Sign in to suggest an edit</h2>
        <p className="text-sm text-slate-600">
          Edit suggestions are tied to your GitHub identity so reviewers can
          follow up if needed.
        </p>
        <a
          href={githubLoginUrl(`/suggest-edit/${slug}`)}
          className="inline-flex items-center justify-center w-full px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800"
        >
          Sign in with GitHub
        </a>
      </div>
    );
  }

  if (conferenceQuery.error) {
    return (
      <div className="space-y-3">
        <p className="text-rose-700">
          Couldn't load that conference: {String(conferenceQuery.error)}
        </p>
        <Link to="/" className="text-sky-700 underline">
          Back to upcoming
        </Link>
      </div>
    );
  }

  const c = conferenceQuery.data!;

  if (done) {
    return (
      <div className="space-y-3">
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-emerald-900">
          Thanks! Your edit suggestion was submitted and is awaiting review.
        </div>
        <Link to="/" className="text-sky-700 underline text-sm">
          Back to upcoming
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Suggest edit: {c.name}</h2>
        <p className="text-sm text-slate-600">
          Make your changes and submit. The current admin will review and either
          apply or decline the edit.
        </p>
      </div>
      <ConferenceForm
        initial={c}
        submitLabel="Submit edit"
        showNote
        onSubmit={async (input, extras) => {
          await submitEdit(c.slug, {
            ...input,
            submissionNote: extras.submissionNote ?? null,
          });
          setDone(true);
        }}
      />
    </div>
  );
}
