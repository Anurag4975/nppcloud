import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token)
    return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const { data: row, error } = await supabaseAdmin()
    .from("preview_tokens")
    .select("expires_at,files(object_key,mime_type,status,name)")
    .eq("token", token)
    .limit(1)
    .single();
  if (error || !row)
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const obj = (row as any).files;
  if (new Date(row.expires_at) < new Date())
    return NextResponse.json({ error: "Token expired" }, { status: 410 });
  if (obj.status !== "active")
    return NextResponse.json({ error: "File unavailable" }, { status: 410 });

  const s3 = new S3Client({
    endpoint: process.env.B2_ENDPOINT!,
    region: process.env.B2_REGION!,
    credentials: {
      accessKeyId: process.env.B2_KEY_ID!,
      secretAccessKey: process.env.B2_APPLICATION_KEY!,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  const isDownload = req.nextUrl.searchParams.get("download") === "1";
  const range = req.headers.get("range");

  // Do NOT set ResponseContentType / ResponseContentDisposition on the
  // signed URL — they break byte-range support on B2.
  const signedUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.B2_BUCKET!,
      Key: obj.object_key,
    }),
    { expiresIn: 120 },
  );

  const b2 = await fetch(signedUrl, {
    headers: range ? { Range: range } : {},
  });

  const headers = new Headers();

  for (const h of [
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const v = b2.headers.get(h);
    if (v) headers.set(h, v);
  }

  headers.set("Content-Type", obj.mime_type || "application/octet-stream");
  if (!headers.has("Accept-Ranges")) headers.set("Accept-Ranges", "bytes");

  if (isDownload) {
    const name = obj.name ?? obj.object_key.split("/").pop() ?? "download";
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(name)}"`,
    );
  } else {
    headers.set("Content-Disposition", "inline");
  }

  headers.set("Cache-Control", "private, max-age=0, no-store");

  return new Response(b2.body, {
    status: b2.status,
    statusText: b2.statusText,
    headers,
  });
}
