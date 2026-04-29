import { useEffect, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  ApiError,
  adminApprove,
  adminCreate,
  adminDelete,
  adminList,
  adminReject,
  adminUpdate,
  createInvite,
  deleteInvite,
  deleteMember,
  getMe,
  getAdminToken,
  githubLoginUrl,
  listInvites,
  listMembers,
  logout as logoutApi,
  setAdminToken,
  type AuthMe,
} from "../api";
import { ConferenceForm } from "../components/ConferenceForm";
import type { Conference } from "@fc/shared";

type Tab = "pending" | "all" | "new" | "members";

const AUTH_ERRORS: Record<string, string> = {
  not_invited: "That GitHub account isn't invited. Ask an admin to invite you.",
  github_token_exchange_failed: "GitHub sign-in failed during token exchange.",
  github_no_token: "GitHub didn't return an access token.",
  github_user_fetch_failed: "Couldn't fetch your GitHub profile.",
  invalid_state: "Sign-in expired or was tampered with. Try again.",
};

export function AdminPage() {
  const qc = useQueryClient();
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  const authError = params.get("auth_error");
  useEffect(() => {
    if (authError) {
      // Clear from URL after reading.
      params.delete("auth_error");
      setParams(params, { replace: true });
    }
  }, [authError, params, setParams]);

  const meQuery = useQuery<AuthMe>({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
  });

  const onUnauthorized = (reason: string) => {
    setAdminToken(null);
    setTokenError(reason);
    qc.invalidateQueries({ queryKey: ["auth", "me"] });
    qc.removeQueries({ queryKey: ["admin"] });
  };

  if (meQuery.isLoading) return <p>Loading…</p>;

  const me = meQuery.data;
  const isAuthed = !!me?.authenticated;

  if (!isAuthed) {
    return (
      <SignInPanel
        prefilledError={
          tokenError ?? (authError ? AUTH_ERRORS[authError] ?? authError : null)
        }
        onTokenSubmit={(t) => {
          setAdminToken(t);
          setTokenError(null);
          qc.invalidateQueries({ queryKey: ["auth", "me"] });
        }}
      />
    );
  }

  return (
    <AdminApp
      me={me!}
      onLogout={async (reason) => {
        if (me!.kind === "user") {
          await logoutApi().catch(() => {});
        }
        setAdminToken(null);
        setTokenError(reason ?? null);
        qc.invalidateQueries({ queryKey: ["auth", "me"] });
        qc.removeQueries({ queryKey: ["admin"] });
      }}
      onUnauthorized={onUnauthorized}
    />
  );
}

function SignInPanel({
  onTokenSubmit,
  prefilledError,
}: {
  onTokenSubmit: (token: string) => void;
  prefilledError: string | null;
}) {
  const [showToken, setShowToken] = useState(false);
  const [val, setVal] = useState("");

  return (
    <div className="max-w-sm space-y-4">
      <h2 className="text-lg font-semibold">Admin</h2>
      {prefilledError && (
        <p className="text-sm text-rose-700">{prefilledError}</p>
      )}
      <a
        href={githubLoginUrl()}
        className="inline-flex items-center justify-center w-full px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800"
      >
        Sign in with GitHub
      </a>
      <div className="text-center text-sm text-slate-500">or</div>
      {!showToken ? (
        <button
          onClick={() => setShowToken(true)}
          className="text-sm text-slate-600 underline"
        >
          Use admin token
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (val) onTokenSubmit(val);
          }}
          className="space-y-3"
        >
          <input
            type="password"
            className="w-full border border-slate-300 rounded-md px-3 py-1.5"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="ADMIN_TOKEN"
            autoFocus
          />
          <button className="px-4 py-2 bg-slate-700 text-white rounded-md text-sm">
            Continue
          </button>
        </form>
      )}
    </div>
  );
}

function AdminApp({
  me,
  onLogout,
  onUnauthorized,
}: {
  me: AuthMe;
  onLogout: (reason?: string) => void;
  onUnauthorized: (reason: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("pending");

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1 flex-wrap">
          <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
            Pending
          </TabButton>
          <TabButton active={tab === "all"} onClick={() => setTab("all")}>
            All
          </TabButton>
          <TabButton active={tab === "new"} onClick={() => setTab("new")}>
            Add new
          </TabButton>
          <TabButton active={tab === "members"} onClick={() => setTab("members")}>
            Members
          </TabButton>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          {me.authenticated && me.kind === "user" && (
            <span className="flex items-center gap-2">
              {me.user.avatarUrl && (
                <img
                  src={me.user.avatarUrl}
                  className="w-6 h-6 rounded-full"
                  alt=""
                />
              )}
              <span>{me.user.githubLogin}</span>
            </span>
          )}
          {me.authenticated && me.kind === "token" && (
            <span className="text-amber-700">break-glass token</span>
          )}
          <button onClick={() => onLogout()} className="underline">
            Sign out
          </button>
        </div>
      </div>
      {tab === "pending" && <PendingTab onUnauthorized={onUnauthorized} />}
      {tab === "all" && <AllTab onUnauthorized={onUnauthorized} />}
      {tab === "new" && <NewTab onUnauthorized={onUnauthorized} />}
      {tab === "members" && <MembersTab onUnauthorized={onUnauthorized} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm ${
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function useUnauthorizedWatcher(
  error: unknown,
  onUnauthorized: (reason: string) => void,
) {
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      const isToken = !!getAdminToken();
      onUnauthorized(
        isToken
          ? "Invalid admin token. Try again."
          : "Your session expired. Sign in again.",
      );
    }
  }, [error, onUnauthorized]);
}

function PendingTab({ onUnauthorized }: { onUnauthorized: (reason: string) => void }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "pending"],
    queryFn: () => adminList("pending"),
    retry: false,
  });
  useUnauthorizedWatcher(error, onUnauthorized);

  const approve = useMutation({
    mutationFn: adminApprove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminReject(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  const remove = useMutation({
    mutationFn: adminDelete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Conference> }) =>
      adminUpdate(id, input as never),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="text-rose-700">Failed to load: {String(error)}</p>;
  if (!data || data.length === 0)
    return <p className="text-slate-500">No pending submissions.</p>;

  return (
    <ul className="space-y-4">
      {data.map((c) => (
        <PendingRow
          key={c.id}
          c={c}
          onApprove={() => approve.mutate(c.id)}
          onReject={(reason) => reject.mutate({ id: c.id, reason })}
          onDelete={() => remove.mutate(c.id)}
          onSave={(input) => update.mutateAsync({ id: c.id, input })}
        />
      ))}
    </ul>
  );
}

function PendingRow({
  c,
  onApprove,
  onReject,
  onDelete,
  onSave,
}: {
  c: Conference;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onDelete: () => void;
  onSave: (input: Partial<Conference>) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="border border-slate-200 rounded-md p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{c.name}</div>
          <div className="text-sm text-slate-500">
            {c.dateStart} → {c.dateEnd} · {c.location}
            {c.online && " · Online"}
          </div>
          <div className="text-sm">
            <a className="text-sky-700 underline" href={c.website} target="_blank" rel="noreferrer">
              {c.website}
            </a>
          </div>
          {(c.submitterName || c.submitterEmail || c.submissionNote) && (
            <div className="mt-2 text-xs text-slate-600 bg-slate-50 rounded p-2">
              {c.submitterName && <div>By {c.submitterName}</div>}
              {c.submitterEmail && <div>{c.submitterEmail}</div>}
              {c.submissionNote && <div className="mt-1 italic">{c.submissionNote}</div>}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {!editing && (
            <>
              <button onClick={onApprove} className="px-3 py-1 bg-emerald-700 text-white rounded text-sm">
                Approve
              </button>
              <button onClick={() => setEditing(true)} className="px-3 py-1 bg-slate-200 rounded text-sm">
                Edit
              </button>
              <button
                onClick={() => {
                  const reason = prompt("Rejection reason?");
                  if (reason) onReject(reason);
                }}
                className="px-3 py-1 bg-rose-700 text-white rounded text-sm"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this submission permanently?")) onDelete();
                }}
                className="px-3 py-1 text-rose-700 underline text-sm"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-4">
          <ConferenceForm
            initial={c}
            submitLabel="Save edits & approve"
            onSubmit={async (input) => {
              await onSave(input);
              onApprove();
              setEditing(false);
            }}
          />
          <button onClick={() => setEditing(false)} className="mt-2 text-sm underline">
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}

function AllTab({ onUnauthorized }: { onUnauthorized: (reason: string) => void }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "all"],
    queryFn: () => adminList(),
    retry: false,
  });
  useUnauthorizedWatcher(error, onUnauthorized);
  const remove = useMutation({
    mutationFn: adminDelete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
  const [editing, setEditing] = useState<string | null>(null);
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Conference> }) =>
      adminUpdate(id, input as never),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      setEditing(null);
    },
  });

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p className="text-rose-700">Failed to load: {String(error)}</p>;
  if (!data) return null;

  return (
    <ul className="space-y-3">
      {data.map((c) => (
        <li key={c.id} className="border border-slate-200 rounded-md p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium">
                {c.name}{" "}
                <span className={`text-xs px-2 py-0.5 rounded ${
                  c.moderationStatus === "approved" ? "bg-emerald-100 text-emerald-800"
                    : c.moderationStatus === "pending" ? "bg-amber-100 text-amber-800"
                    : "bg-rose-100 text-rose-800"
                }`}>
                  {c.moderationStatus}
                </span>
              </div>
              <div className="text-sm text-slate-500">
                {c.dateStart} → {c.dateEnd} · {c.location}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(editing === c.id ? null : c.id)} className="px-3 py-1 bg-slate-200 rounded text-sm">
                {editing === c.id ? "Close" : "Edit"}
              </button>
              <button
                onClick={() => { if (confirm(`Delete "${c.name}"?`)) remove.mutate(c.id); }}
                className="px-3 py-1 text-rose-700 underline text-sm"
              >
                Delete
              </button>
            </div>
          </div>
          {editing === c.id && (
            <div className="mt-4">
              <ConferenceForm
                initial={c}
                submitLabel="Save"
                onSubmit={async (input) => {
                  await update.mutateAsync({ id: c.id, input });
                }}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function NewTab({ onUnauthorized }: { onUnauthorized: (reason: string) => void }) {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: adminCreate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        onUnauthorized("Your session expired. Sign in again.");
      }
    },
  });
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-emerald-900">
        Conference created.
        <button className="ml-3 underline" onClick={() => setDone(false)}>
          Add another
        </button>
      </div>
    );
  }

  return (
    <ConferenceForm
      submitLabel="Create"
      onSubmit={async (input) => {
        await create.mutateAsync(input);
        setDone(true);
      }}
    />
  );
}

function MembersTab({ onUnauthorized }: { onUnauthorized: (reason: string) => void }) {
  const qc = useQueryClient();
  const members = useQuery({
    queryKey: ["admin", "members"],
    queryFn: listMembers,
    retry: false,
  });
  const invitesQ = useQuery({
    queryKey: ["admin", "invites"],
    queryFn: listInvites,
    retry: false,
  });
  useUnauthorizedWatcher(members.error ?? invitesQ.error, onUnauthorized);

  const invite = useMutation({
    mutationFn: createInvite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "invites"] }),
  });
  const removeInvite = useMutation({
    mutationFn: deleteInvite,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "invites"] }),
  });
  const removeMember = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "members"] }),
  });

  const [login, setLogin] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    try {
      await invite.mutateAsync(login.trim());
      setLogin("");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "invite failed");
    }
  };

  if (members.isLoading || invitesQ.isLoading) return <p>Loading…</p>;
  if (members.error)
    return <p className="text-rose-700">Failed to load: {String(members.error)}</p>;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-medium mb-2">Invite by GitHub username</h3>
        <form onSubmit={onInvite} className="flex gap-2">
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="octocat"
            className="flex-1 border border-slate-300 rounded-md px-3 py-1.5"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!login.trim() || invite.isPending}
            className="px-4 py-2 bg-slate-900 text-white rounded-md disabled:opacity-50"
          >
            Invite
          </button>
        </form>
        {inviteError && <p className="text-sm text-rose-700 mt-1">{inviteError}</p>}
      </section>

      <section>
        <h3 className="font-medium mb-2">Pending invites</h3>
        {!invitesQ.data || invitesQ.data.length === 0 ? (
          <p className="text-sm text-slate-500">None.</p>
        ) : (
          <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md">
            {invitesQ.data.map((i) => (
              <li key={i.id} className="px-3 py-2 flex items-center justify-between">
                <span>
                  <span className="font-medium">@{i.githubLogin}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    invited {new Date(i.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <button
                  onClick={() => removeInvite.mutate(i.id)}
                  className="text-sm text-rose-700 underline"
                >
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-medium mb-2">Members</h3>
        {!members.data || members.data.length === 0 ? (
          <p className="text-sm text-slate-500">No members yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md">
            {members.data.map((m) => (
              <li key={m.id} className="px-3 py-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {m.avatarUrl && (
                    <img src={m.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                  )}
                  <span className="font-medium">@{m.githubLogin}</span>
                  {m.name && <span className="text-sm text-slate-500">({m.name})</span>}
                </span>
                <button
                  onClick={() => {
                    if (confirm(`Remove @${m.githubLogin}?`)) removeMember.mutate(m.id);
                  }}
                  className="text-sm text-rose-700 underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
