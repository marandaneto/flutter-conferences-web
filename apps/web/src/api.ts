import type { Conference, ConferenceInput, SubmissionInput } from "@fc/shared";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function url(path: string): string {
  return `${API_BASE}${path}`;
}

export type Member = {
  id: string;
  githubLogin: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type Invite = {
  id: string;
  githubLogin: string;
  createdAt: string;
  acceptedAt: string | null;
};

export type AuthMe =
  | { authenticated: false }
  | { authenticated: true; kind: "user"; user: Member }
  | { authenticated: true; kind: "token" };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// "auth" stores either an admin token (break-glass) or a server-issued session id.
// Both are sent as Authorization: Bearer; the server distinguishes them.
const AUTH_KEY = "fc:auth";

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem(AUTH_KEY, token);
  else localStorage.removeItem(AUTH_KEY);
}

// Back-compat aliases (the existing `fc:admin-token` key is migrated on read).
export function getAdminToken(): string | null {
  const v = getAuthToken();
  if (v) return v;
  const legacy = localStorage.getItem("fc:admin-token");
  if (legacy) {
    setAuthToken(legacy);
    localStorage.removeItem("fc:admin-token");
    return legacy;
  }
  return null;
}

export function setAdminToken(token: string | null) {
  setAuthToken(token);
}

type ApiInit = RequestInit & { json?: unknown };

async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAuthToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(init.json);
  }
  const res = await fetch(url(path), {
    ...init,
    headers,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, `${res.status} ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Public

export function listConferences(filter: "upcoming" | "online" | "past") {
  return api<Conference[]>(`/api/conferences?filter=${filter}`);
}

export function submitConference(input: SubmissionInput) {
  return api<Conference>("/api/submissions", { method: "POST", json: input });
}

// Auth

export function getMe() {
  return api<AuthMe>("/api/auth/me");
}

export function logout() {
  return api<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export function githubLoginUrl(): string {
  return url("/auth/github/start");
}

// Admin: conferences

export function adminList(status?: "pending" | "approved" | "rejected") {
  return api<Conference[]>(
    status
      ? `/api/admin/conferences?status=${status}`
      : "/api/admin/conferences",
  );
}

export function adminCreate(input: ConferenceInput) {
  return api<Conference>("/api/admin/conferences", { method: "POST", json: input });
}

export function adminUpdate(id: string, input: Partial<ConferenceInput>) {
  return api<Conference>(`/api/admin/conferences/${id}`, {
    method: "PATCH",
    json: input,
  });
}

export function adminApprove(id: string) {
  return api<Conference>(`/api/admin/conferences/${id}/approve`, { method: "POST" });
}

export function adminReject(id: string, reason: string) {
  return api<Conference>(`/api/admin/conferences/${id}/reject`, {
    method: "POST",
    json: { reason },
  });
}

export function adminDelete(id: string) {
  return api<void>(`/api/admin/conferences/${id}`, { method: "DELETE" });
}

// Admin: members + invites

export function listMembers() {
  return api<Member[]>("/api/admin/members");
}

export function deleteMember(id: string) {
  return api<void>(`/api/admin/members/${id}`, { method: "DELETE" });
}

export function listInvites() {
  return api<Invite[]>("/api/admin/invites");
}

export function createInvite(githubLogin: string) {
  return api<Invite>("/api/admin/invites", {
    method: "POST",
    json: { githubLogin },
  });
}

export function deleteInvite(id: string) {
  return api<void>(`/api/admin/invites/${id}`, { method: "DELETE" });
}
