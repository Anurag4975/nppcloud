"use client";
import { useEffect, useState } from "react";
import { Share2, Copy, Trash2, Link2, Check, Download } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast, Button, EmptyState, Card, Badge, Progress, cn, formatBytes, timeAgo } from "@/components/ui";
import type { ShareLink } from "@/lib/types";

export default function SharedClient() {
  const toast = useToast();
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ links: ShareLink[] }>("/api/share-links")
      .then((r) => setLinks(r.links))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function revoke(id: string) {
    try {
      await api.del(`/api/share-links/${id}`);
      toast("Link revoked");
      setLinks((l) => l.map((x) => (x.id === id ? { ...x, revoked: true } : x)));
    } catch (e) {
      toast((e as ApiError).message, "error");
    }
  }

  function copyLink(id: string) {
    navigator.clipboard.writeText(`${location.origin}/s/${id}`).then(() => {
      setCopiedId(id);
      toast("Link copied");
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900">Shared links</h1>
          <p className="mt-0.5 text-xs text-ink-500">
            {links.filter((l) => !l.revoked).length} active link{links.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : links.length === 0 ? (
        <EmptyState
          icon={<Share2 className="h-6 w-6" />}
          title="No shared links yet"
          subtitle="Share a file from My Files to create a public download link."
        />
      ) : (
        <div className="space-y-3">
          {links.map((l, i) => {
            const dlPct = l.max_downloads > 0 ? (l.downloads_count / l.max_downloads) * 100 : 0;
            const bwPct = l.max_bytes_served > 0 ? (l.bytes_served / l.max_bytes_served) * 100 : 0;
            const expired = l.expires_at ? new Date(l.expires_at) < new Date() : false;
            return (
              <Card
                key={l.id}
                className={cn(
                  "flex animate-slide-up flex-col gap-3 p-4 hover:shadow-card sm:flex-row sm:items-center",
                  l.revoked && "opacity-60"
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      l.revoked ? "bg-ink-100 text-ink-400" : "bg-violet-50 text-violet-600"
                    )}
                  >
                    <Link2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {l.file?.name ?? "File"}
                      </p>
                      {l.revoked && <Badge variant="danger">Revoked</Badge>}
                      {expired && !l.revoked && <Badge variant="warning">Expired</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-ink-400">
                      {formatBytes(l.file?.size_bytes ?? 0)} · created {timeAgo(l.created_at)}
                      {l.expires_at && ` · expires ${new Date(l.expires_at).toLocaleDateString()}`}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex flex-1 items-center gap-2">
                        <Download className="h-3 w-3 text-ink-300" />
                        <Progress value={dlPct} className="h-1 max-w-[120px]" />
                        <span className="text-[10px] text-ink-400">
                          {l.downloads_count}/{l.max_downloads}
                        </span>
                      </div>
                      <div className="hidden items-center gap-2 sm:flex">
                        <span className="text-[10px] text-ink-400">
                          {formatBytes(l.bytes_served)} / {formatBytes(l.max_bytes_served)}
                        </span>
                        <Progress value={bwPct} className="h-1 w-16" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyLink(l.id)}>
                    {copiedId === l.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedId === l.id ? "Copied" : "Copy"}
                  </Button>
                  {!l.revoked && (
                    <Button variant="ghost" size="sm" onClick={() => revoke(l.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Revoke
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
