"use client";
import { useEffect, useState } from "react";
import { X, Download, FileWarning, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button, useToast, cn, formatBytes } from "@/components/ui";
import type { FileRow } from "@/lib/types";

type ViewerKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "text"
  | "office"
  | "unsupported";

const OFFICE_EXT = /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)$/i;
const TEXT_EXT = /\.(txt|md|csv|json|js|jsx|ts|tsx|css|html|xml|yml|yaml|log|py|java|c|cpp|go|rs|sh|sql)$/i;

function classify(name: string, mime: string | null): ViewerKind {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf" || name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (OFFICE_EXT.test(name)) return "office";
  if (m.startsWith("text/") || TEXT_EXT.test(name)) return "text";
  return "unsupported";
}

interface PreviewModalProps {
  file: FileRow | null;
  onClose: () => void;
  onDownload: (id: string) => void;
}

/**
 * In-app preview. Detects file type and renders the right viewer:
 *   image  → <img>
 *   video  → <video controls> (B2 supports range requests → seeking works)
 *   audio  → <audio controls>
 *   pdf    → browser PDF viewer via <iframe>
 *   text   → fetched as text, rendered in a scrollable pane
 *   office → Microsoft Office Online iframe (free, no API key)
 *   else   → "no preview" + download button
 * Uses preview-url (no download-quota charge). 1h signed URL.
 */
export function PreviewModal({ file, onClose, onDownload }: PreviewModalProps) {
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      setMime(null);
      setTextContent(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setTextContent(null);
    let cancelled = false;
    api
      .get<{ preview_url: string; mime_type: string | null }>(
        `/api/files/${file.id}/preview-url`,
      )
      .then(async (r) => {
        if (cancelled) return;
        setUrl(r.preview_url);
        setMime(r.mime_type);
        const kind = classify(file.name, r.mime_type);
        if (kind === "text") {
          try {
            const res = await fetch(r.preview_url);
            const text = await res.text();
            if (!cancelled) setTextContent(text.slice(0, 500_000)); // cap at 500KB
          } catch {
            if (!cancelled) setTextContent("(could not load text preview)");
          }
        }
      })
      .catch((e: ApiError) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!file) return null;
  const kind = classify(file.name, mime);

  const officeUrl = url
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
    : null;

  return (
    <div className="fixed inset-0 z-[950] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative flex h-full max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-pop animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-900">{file.name}</p>
            <p className="text-[11px] text-ink-400">
              {formatBytes(file.size_bytes)} · {mime ?? "unknown type"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onDownload(file.id)}>
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-auto bg-ink-50/60">
          {loading && (
            <div className="flex h-full items-center justify-center text-ink-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {error && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <FileWarning className="h-10 w-10 text-ink-300" />
              <p className="text-sm text-ink-600">{error}</p>
            </div>
          )}
          {!loading && !error && url && kind === "image" && (
            <div className="flex h-full items-center justify-center p-4">
              <img src={url} alt={file.name} className="max-h-full max-w-full rounded-lg object-contain shadow-soft" />
            </div>
          )}
          {!loading && !error && url && kind === "video" && (
            <div className="flex h-full items-center justify-center p-4">
              <video src={url} controls autoPlay className="max-h-full max-w-full rounded-lg shadow-soft" />
            </div>
          )}
          {!loading && !error && url && kind === "audio" && (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-ink-900 text-white">
                <Download className="h-8 w-8" />
              </div>
              <audio src={url} controls autoPlay className="w-full max-w-md" />
            </div>
          )}
          {!loading && !error && url && kind === "pdf" && (
            <iframe src={url} title={file.name} className="h-full w-full border-0 bg-white" />
          )}
          {!loading && !error && kind === "text" && (
            <pre className="m-0 h-full overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[12px] leading-relaxed text-ink-800">
              {textContent ?? ""}
            </pre>
          )}
          {!loading && !error && officeUrl && kind === "office" && (
            <iframe src={officeUrl} title={file.name} className="h-full w-full border-0 bg-white" />
          )}
          {!loading && !error && kind === "unsupported" && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <FileWarning className="h-10 w-10 text-ink-300" />
              <p className="text-sm font-medium text-ink-700">No preview available for this file type</p>
              <p className="max-w-xs text-xs text-ink-400">
                Download it to view, or try images, video, audio, PDF, text, and Office documents — those preview inline.
              </p>
              <Button onClick={() => onDownload(file.id)}>
                <Download className="h-4 w-4" /> Download file
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
