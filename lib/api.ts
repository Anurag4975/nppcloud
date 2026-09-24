// Typed fetch wrapper for client components. Centralizes error handling so
// every call site gets a consistent { code, message } error instead of
// ad-hoc res.json() parsing.
import type { ApiErrorBody } from "./types";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, body: ApiErrorBody["error"]) {
    super(body?.message ?? "Request failed");
    this.code = body?.code ?? "unknown";
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    throw new ApiError(res.status, json?.error);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
