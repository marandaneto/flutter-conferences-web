import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { ConferenceForm } from "../components/ConferenceForm";
import {
  getMe,
  githubLoginUrl,
  submitConference,
  type AuthMe,
} from "../api";

const AUTH_ERRORS: Record<string, string> = {
  github_token_exchange_failed: "GitHub sign-in failed during token exchange.",
  github_no_token: "GitHub didn't return an access token.",
  github_user_fetch_failed: "Couldn't fetch your GitHub profile.",
  invalid_state: "Sign-in expired or was tampered with. Try again.",
};

export function SuggestPage() {
  const [params, setParams] = useSearchParams();
  const [done, setDone] = useState(false);

  const authError = params.get("auth_error");
  useEffect(() => {
    if (authError) {
      params.delete("auth_error");
      setParams(params, { replace: true });
    }
  }, [authError, params, setParams]);

  const meQuery = useQuery<AuthMe>({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
  });

  if (meQuery.isLoading) return <p>Loading…</p>;

  const me = meQuery.data;
  const isAuthed = me?.authenticated;

  if (!isAuthed) {
    return (
      <div className="max-w-md space-y-4">
        <h2 className="text-lg font-semibold">Suggest a conference</h2>
        <p className="text-sm text-slate-600">
          Sign in with GitHub to submit a suggestion. Your GitHub identity is
          attached to the submission so reviewers can follow up.
        </p>
        {authError && (
          <p className="text-sm text-rose-700">
            {AUTH_ERRORS[authError] ?? authError}
          </p>
        )}
        <a
          href={githubLoginUrl("/suggest")}
          className="inline-flex items-center justify-center w-full px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800"
        >
          Sign in with GitHub
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-emerald-900">
        Thanks! Your suggestion was submitted and is awaiting review.
        <button className="ml-3 underline" onClick={() => setDone(false)}>
          Submit another
        </button>
      </div>
    );
  }

  const userLabel =
    me.kind === "user" ? `@${me.user.githubLogin}` : "break-glass token";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Suggest a conference</h2>
        <p className="text-sm text-slate-600">
          Submitting as <span className="font-medium">{userLabel}</span>. Your
          GitHub email and name will be attached to the suggestion.
        </p>
      </div>
      <ConferenceForm
        submitLabel="Submit suggestion"
        showNote
        onSubmit={async (input, extras) => {
          await submitConference({
            ...input,
            submissionNote: extras.submissionNote ?? null,
          });
          setDone(true);
        }}
      />
    </div>
  );
}
