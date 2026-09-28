// Shared domain types. Single source of truth — every API route and client
// component imports from here instead of re-declaring inline.

export type FileStatus = "pending" | "active" | "trashed";
export type FolderStatus = "active" | "trashed";
export type SubscriptionStatus = "active" | "past_due" | "expired" | "canceled";
export type UserRole = "user" | "admin";

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  accepted_terms_at: string | null;
  onboarded_at: string | null;
  phone: string | null;
  phone_verified_at: string | null;
  last_active_at: string | null;
  created_at: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  quota_bytes: number;
  price_npr: number;
  billing_interval: "month" | "year";
  download_multiplier: number;
  max_file_size_bytes: number;
  is_household: boolean;
  max_members: number;
  is_active: boolean;
  sort_order: number;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  scheduled_plan_id: string | null;
}

export interface FolderRow {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  status: FolderStatus;
  trashed_at: string | null;
  starred?: boolean;
  created_at: string;
  updated_at: string;
}

export interface FileRow {
  id: string;
  user_id: string;
  name: string;
  size_bytes: number;
  mime_type: string | null;
  parent_id: string | null;
  object_key: string;
  storage_provider_id: string | null;
  status: FileStatus;
  created_at: string;
  updated_at: string;
  trashed_at: string | null;
  starred?: boolean;
}

export interface UsageRow {
  user_id: string;
  stored_bytes: number;
  uploaded_bytes: number;
  downloaded_bytes: number;
  updated_at: string;
}

export interface ShareLink {
  id: string;
  file_id: string;
  created_by: string;
  max_downloads: number;
  downloads_count: number;
  max_bytes_served: number;
  bytes_served: number;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
  file?: { name: string; size_bytes: number };
}

export interface UsageResponse {
  plan: Pick<Plan, "id" | "name" | "quota_bytes" | "download_multiplier"> | null;
  usage: Pick<UsageRow, "stored_bytes" | "uploaded_bytes" | "downloaded_bytes"> | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}
