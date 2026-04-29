import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  adminApprove,
  adminCreate,
  adminDelete,
  adminList,
  adminReject,
  adminUpdate,
  getAdminToken,
  setAdminToken,
} from "../api";
import { ConferenceForm } from "../components/ConferenceForm";
import type { Conference } from "@fc/shared";

type Tab = "pending" | "all" | "new";

export function AdminPage() {
  const [token, setToken] = useState(getAdminToken());

  if (!token) {
    return <TokenGate onSave={(t) => { setAdminToken(t); setToken(t); }} />;
  }

  return <AdminApp onLogout={() => { setAdminToken(null); setToken(null); }} />;
}

function TokenGate({ onSave }: { onSave: (token: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (val) onSave(val); }}
      className="max-w-sm space-y-3"
    >
      <h2 className="text-lg font-semibold">Admin</h2>
      <p className="text-sm text-slate-600">Paste the admin token to continue.</p>
      <input
        type="password"
        className="w-full border border-slate-300 rounded-md px-3 py-1.5"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="ADMIN_TOKEN"
      />
      <button className="px-4 py-2 bg-slate-900 text-white rounded-md">Continue</button>
    </form>
  );
}

function AdminApp({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("pending");
  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1">
          <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
            Pending
          </TabButton>
          <TabButton active={tab === "all"} onClick={() => setTab("all")}>
            All
          </TabButton>
          <TabButton active={tab === "new"} onClick={() => setTab("new")}>
            Add new
          </TabButton>
        </div>
        <button onClick={onLogout} className="text-sm text-slate-500 underline">
          Sign out
        </button>
      </div>
      {tab === "pending" && <PendingTab />}
      {tab === "all" && <AllTab />}
      {tab === "new" && <NewTab />}
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

function PendingTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "pending"],
    queryFn: () => adminList("pending"),
  });

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

function AllTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "all"],
    queryFn: () => adminList(),
  });
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

function NewTab() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: adminCreate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
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
