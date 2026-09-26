"use client";
import { HardDrive, Files, FolderOpen, Share2, ArrowUpRight } from "lucide-react";
import { Card, cn, formatBytes } from "@/components/ui";

interface StatCardsProps {
  usedBytes: number;
  totalBytes: number;
  fileCount: number;
  folderCount: number;
  sharedCount: number;
}

const cards = [
  { key: "storage", label: "Storage used", icon: HardDrive, tint: "text-brand-600", bg: "bg-brand-50" },
  { key: "files", label: "Files", icon: Files, tint: "text-sky-600", bg: "bg-sky-50" },
  { key: "folders", label: "Folders", icon: FolderOpen, tint: "text-amber-600", bg: "bg-amber-50" },
  { key: "shared", label: "Shared links", icon: Share2, tint: "text-violet-600", bg: "bg-violet-50" },
] as const;

export function StatCards({ usedBytes, totalBytes, fileCount, folderCount, sharedCount }: StatCardsProps) {
  const values: Record<(typeof cards)[number]["key"], string> = {
    storage: `${formatBytes(usedBytes)}`,
    files: String(fileCount),
    folders: String(folderCount),
    shared: String(sharedCount),
  };
  const sub: Record<(typeof cards)[number]["key"], string> = {
    storage: `of ${formatBytes(totalBytes)}`,
    files: "in this folder",
    folders: "in this folder",
    shared: "active",
  };

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <Card
            key={c.key}
            className={cn(
              "group relative overflow-hidden p-4 hover:shadow-card",
              "animate-slide-up"
            )}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-start justify-between">
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", c.bg)}>
                <Icon className={cn("h-5 w-5", c.tint)} strokeWidth={2} />
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-ink-300 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
            </div>
            <p className="mt-3 text-xl font-bold tracking-tight text-ink-900">{values[c.key]}</p>
            <p className="mt-0.5 text-[11px] text-ink-500">
              {c.label} <span className="text-ink-400">· {sub[c.key]}</span>
            </p>
          </Card>
        );
      })}
    </div>
  );
}
