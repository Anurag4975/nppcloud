import * as React from "react";
import {
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileQuestion,
  Folder,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MIME_STYLES: { test: RegExp; icon: React.ElementType; tint: string; bg: string }[] = [
  { test: /^image\//, icon: FileImage, tint: "text-violet-600", bg: "bg-violet-50 ring-violet-100" },
  { test: /^video\//, icon: FileVideo, tint: "text-rose-600", bg: "bg-rose-50 ring-rose-100" },
  { test: /^audio\//, icon: FileAudio, tint: "text-amber-600", bg: "bg-amber-50 ring-amber-100" },
  { test: /pdf/, icon: FileText, tint: "text-red-600", bg: "bg-red-50 ring-red-100" },
  { test: /zip|tar|rar|7z|compressed/, icon: FileArchive, tint: "text-yellow-700", bg: "bg-yellow-50 ring-yellow-100" },
  { test: /sheet|excel|spreadsheet|csv/, icon: FileSpreadsheet, tint: "text-emerald-700", bg: "bg-emerald-50 ring-emerald-100" },
  { test: /word|document|rtf/, icon: FileText, tint: "text-blue-700", bg: "bg-blue-50 ring-blue-100" },
  { test: /^text\/|json|xml|javascript|typescript|html|css|code/, icon: FileCode2, tint: "text-teal-700", bg: "bg-teal-50 ring-teal-100" },
];

export function FileTypeIcon({
  mime,
  className,
  size = "md",
}: {
  mime: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const m = mime ?? "";
  const match = MIME_STYLES.find((s) => s.test.test(m)) ?? {
    icon: File,
    tint: "text-ink-500",
    bg: "bg-ink-100 ring-ink-200",
  };
  const Icon = match.icon;
  const sizes = {
    sm: "h-7 w-7 rounded-lg",
    md: "h-9 w-9 rounded-xl",
    lg: "h-12 w-12 rounded-2xl",
  };
  const iconSizes = { sm: "h-3.5 w-3.5", md: "h-5 w-5", lg: "h-6 w-6" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center ring-1 ring-inset",
        sizes[size],
        match.bg,
        className
      )}
    >
      <Icon className={cn(iconSizes[size], match.tint)} strokeWidth={1.8} />
    </span>
  );
}

export function FolderGlyph({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-7 w-7", md: "h-9 w-9", lg: "h-12 w-12" };
  const iconSizes = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500 ring-1 ring-inset ring-amber-100",
        sizes[size],
        className
      )}
    >
      <Folder className={iconSizes[size]} strokeWidth={1.8} fill="currentColor" fillOpacity={0.15} />
    </span>
  );
}

export { FileQuestion };
