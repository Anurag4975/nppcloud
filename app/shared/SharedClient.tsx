"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast, Button, EmptyState, formatBytes } from "@/components/ui/core";
import { ShareIcon, TrashIcon } from "@/components/ui/icons";
import type { ShareLink } from "@/lib/types";

export default function SharedClient() {
  const toast = useToast();
  const [links, setLinks] = useState<ShareLink[]>([]);
  useEffect(() => { api.get<{ links: ShareLink[] }>("/api/share-links").then((r) => setLinks(r.links)).catch(() => {}); }, []);

  async function revoke(id: string) {
    try {
      await api.del(`/api/share-links/${id}`);
      toast("Link revoked");
      setLinks((l) => l.map((x) => (x.id === id ? { ...x, revoked: true } : x)));
    } catch (e) { toast((e as ApiError).message, "error"); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-5 text-lg font-bold text-slate-900">Shared links</h1>
      {links.length === 0 ? (
        <EmptyState icon={<ShareIcon width={36} height={36} />} title="No shared links yet" subtitle="Share a file from My Files to create one." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{l.file?.name ?? "File"}</p>
                <p className="text-xs text-slate-400">
                  {l.downloads_count}/{l.max_downloads} downloads · {formatBytes(l.bytes_served)} / {formatBytes(l.max_bytes_served)}
                  {l.expires_at && ` · expires ${new Date(l.expires_at).toLocaleDateString()}`}
                  {l.revoked && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">REVOKED</span>}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(`${location.origin}/s/${l.id}`); toast("Link copied"); }}>Copy link</Button>
              {!l.revoked && <Button size="sm" variant="ghost" onClick={() => revoke(l.id)}><TrashIcon width={14} height={14} /> Revoke</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
