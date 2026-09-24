// Sanitized error responses. Every API route returns errors through here so
// stack traces, raw Postgres messages, and schema details never leak.
import { RPC_ERROR_STATUS, RPC_ERROR_MESSAGE } from "./constants";
import type { ApiErrorBody } from "./types";

export function apiError(code: string, message: string, status: number): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status });
}

export function badRequest(message = "Invalid request.") {
  return apiError("invalid_request", message, 400);
}
export function unauthorized() {
  return apiError("unauthorized", "Not signed in.", 401);
}
export function forbidden(message = "You don't have access to this resource.") {
  return apiError("forbidden", message, 403);
}
export function notFound(message = "Not found.") {
  return apiError("not_found", message, 404);
}
export function internalError() {
  // Never include the underlying message — log it server-side instead.
  return apiError("internal_error", "Something went wrong on our end.", 500);
}

/** Maps a Postgres RPC exception (raised as a stable code in error.message) to a sanitized HTTP response. */
export function rpcError(error: { message?: string } | null | undefined): Response {
  const code = error?.message ?? "internal_error";
  const status = RPC_ERROR_STATUS[code] ?? 500;
  const message = status === 500 ? "Something went wrong on our end." : RPC_ERROR_MESSAGE[code] ?? code;
  return apiError(status === 500 ? "internal_error" : code, message, status);
}
