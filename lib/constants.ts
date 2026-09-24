// Stable, shared constants. Error codes raised by Postgres RPCs are mapped to
// HTTP statuses + safe user-facing messages here — the API layer never echoes
// raw database errors to the client.

export const RPC_ERROR_STATUS: Record<string, number> = {
  no_active_plan: 403,
  phone_not_verified: 403,
  file_too_large: 413,
  quota_exceeded: 403,
  invalid_parent: 400,
  file_not_found: 404,
  download_limit_exceeded: 403,
  link_not_found: 404,
  link_revoked: 410,
  link_expired: 410,
  link_download_limit_reached: 429,
  link_bandwidth_limit_reached: 429,
};

export const RPC_ERROR_MESSAGE: Record<string, string> = {
  no_active_plan: "No active plan on this account.",
  phone_not_verified: "This plan requires phone verification.",
  file_too_large: "This file exceeds your plan's maximum file size.",
  quota_exceeded: "Not enough storage space remaining.",
  invalid_parent: "Target folder doesn't exist or isn't yours.",
  file_not_found: "File not found.",
  download_limit_exceeded: "Download allowance exceeded for this billing period.",
  link_not_found: "This link doesn't exist.",
  link_revoked: "This link has been revoked by its owner.",
  link_expired: "This link has expired.",
  link_download_limit_reached: "This link has reached its download limit.",
  link_bandwidth_limit_reached: "This link has reached its bandwidth limit.",
};

export const FILE_STATUSES = { PENDING: "pending", ACTIVE: "active", TRASHED: "trashed" } as const;
export const FOLDER_STATUSES = { ACTIVE: "active", TRASHED: "trashed" } as const;

export const MAX_UPLOAD_NAME_LENGTH = 255;
export const DEFAULT_SHARE_MAX_DOWNLOADS = 50;
export const PRESIGN_TTL_SECONDS = 15 * 60;
