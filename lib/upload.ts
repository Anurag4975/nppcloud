// Client-side upload helpers.
//
// Concurrency pool: the old DashboardClient uploaded files SEQUENTIALLY in a
// for-loop. This pool runs up to CONCURRENCY uploads in parallel with a shared
// queue, so a folder of 50 photos doesn't take 50x one-file time.
//
// Thumbnails: for images, we generate a small (≤320px) JPEG on a canvas and
// upload it alongside the original to `<object_key>.thumb`. Grid view then
// loads these tiny thumbs instead of full-res originals — the difference on a
// folder of 4MB phone photos is night-and-day. Thumbnail bytes are NOT charged
// against quota (they live under a separate key suffix and are not in the
// files table; reclaimed by the same B2 lifecycle as the parent object).

export const UPLOAD_CONCURRENCY = 3;

export type UploadJobState = {
  id: string;
  name: string;
  size: number;
  progress: number; // 0..100
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
};

/** PUT a blob to a presigned URL with XHR progress events. */
export function putWithProgress(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(blob);
  });
}

/** Generate a ≤maxDim JPEG thumbnail for an image file. Returns null for non-images. */
export async function generateThumbnail(file: File, maxDim = 320): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) { URL.revokeObjectURL(url); return null; }
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.82));
  } catch {
    return null;
  }
}

/**
 * Run N async tasks with a fixed concurrency limit. Each task is started via
 * `spawn(item)` and must report its own progress; the pool just gates how
 * many are in flight at once.
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  spawn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await spawn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}
