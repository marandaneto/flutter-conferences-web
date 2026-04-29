import type { Conference, ConferenceInput, SubmissionInput } from "@fc/shared";

const json = { "content-type": "application/json" };
const API_BASE = import.meta.env.VITE_API_URL ?? "";

function url(path: string): string {
  return `${API_BASE}${path}`;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function check<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, `${res.status} ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function listConferences(filter: "upcoming" | "online" | "past") {
  return fetch(url(`/api/conferences?filter=${filter}`)).then((r) =>
    check<Conference[]>(r),
  );
}

export function submitConference(input: SubmissionInput) {
  return fetch(url("/api/submissions"), {
    method: "POST",
    headers: json,
    body: JSON.stringify(input),
  }).then((r) => check<Conference>(r));
}

export function getAdminToken(): string | null {
  return localStorage.getItem("fc:admin-token");
}

export function setAdminToken(token: string | null) {
  if (token) localStorage.setItem("fc:admin-token", token);
  else localStorage.removeItem("fc:admin-token");
}

function adminHeaders() {
  const token = getAdminToken();
  if (!token) throw new Error("missing admin token");
  return { ...json, authorization: `Bearer ${token}` };
}

function adminAuthOnly() {
  const token = getAdminToken();
  if (!token) throw new Error("missing admin token");
  return { authorization: `Bearer ${token}` };
}

export function adminList(status?: "pending" | "approved" | "rejected") {
  const path = status
    ? `/api/admin/conferences?status=${status}`
    : "/api/admin/conferences";
  return fetch(url(path), { headers: adminHeaders() }).then((r) =>
    check<Conference[]>(r),
  );
}

export function adminCreate(input: ConferenceInput) {
  return fetch(url("/api/admin/conferences"), {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(input),
  }).then((r) => check<Conference>(r));
}

export function adminUpdate(id: string, input: Partial<ConferenceInput>) {
  return fetch(url(`/api/admin/conferences/${id}`), {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify(input),
  }).then((r) => check<Conference>(r));
}

export function adminApprove(id: string) {
  return fetch(url(`/api/admin/conferences/${id}/approve`), {
    method: "POST",
    headers: adminAuthOnly(),
  }).then((r) => check<Conference>(r));
}

export function adminReject(id: string, reason: string) {
  return fetch(url(`/api/admin/conferences/${id}/reject`), {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ reason }),
  }).then((r) => check<Conference>(r));
}

export function adminDelete(id: string) {
  return fetch(url(`/api/admin/conferences/${id}`), {
    method: "DELETE",
    headers: adminAuthOnly(),
  }).then((r) => check<void>(r));
}
