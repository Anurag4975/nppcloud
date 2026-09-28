import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const PRESIGN_TTL_SECONDS = 15 * 60; // 15 minutes — keep short, per security design

function client() {
  return new S3Client({
    endpoint: process.env.B2_ENDPOINT!,
    region: process.env.B2_REGION!,
    credentials: {
      accessKeyId: process.env.B2_KEY_ID!,
      secretAccessKey: process.env.B2_APPLICATION_KEY!,
    },
    // Recent AWS SDK v3 versions add checksum headers/query params by
    // default (x-amz-checksum-crc32, x-amz-sdk-checksum-algorithm).
    // Backblaze B2's S3-compatible API doesn't support this the same
    // way AWS does, which breaks presigned URLs — the browser's CORS
    // preflight fails because B2 rejects the request before it ever
    // gets to evaluate CORS. Disabling this restores normal behavior.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

/** The permanent, filename-independent object key for a file. */
export function objectKeyFor(userId: string, fileId: string) {
  return `users/${userId}/objects/${fileId}`;
}

export async function getUploadUrl(objectKey: string, contentType: string) {
  const cmd = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET!,
    Key: objectKey,
    ContentType: contentType,
  });
  return getSignedUrl(client(), cmd, { expiresIn: PRESIGN_TTL_SECONDS });
}

export async function getDownloadUrl(objectKey: string, downloadName?: string) {
  const cmd = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET!,
    Key: objectKey,
    ResponseContentDisposition: downloadName
      ? `attachment; filename="${downloadName}"`
      : undefined,
  });
  return getSignedUrl(client(), cmd, { expiresIn: PRESIGN_TTL_SECONDS });
}

/** Confirms the object actually landed in B2 and returns its real size. */
export async function verifyObjectExists(
  objectKey: string,
): Promise<number | null> {
  try {
    const res = await client().send(
      new HeadObjectCommand({ Bucket: process.env.B2_BUCKET!, Key: objectKey }),
    );
    return res.ContentLength ?? 0;
  } catch {
    return null;
  }
}

/** Permanently deletes an object (used on purge / over-quota rollback). Best-effort: never throws. */
export async function deleteObject(objectKey: string): Promise<void> {
  try {
    await client().send(
      new DeleteObjectCommand({
        Bucket: process.env.B2_BUCKET!,
        Key: objectKey,
      }),
    );
  } catch {
    /* orphan is reclaimed by B2 lifecycle rules; don't block the API response */
  }
}

/** Server-side copy (no re-upload). B2 S3 API supports CopyObject. */
export async function copyObject(
  sourceKey: string,
  destKey: string,
): Promise<void> {
  await client().send(
    new CopyObjectCommand({
      Bucket: process.env.B2_BUCKET!,
      CopySource: `${process.env.B2_BUCKET}/${sourceKey}`,
      Key: destKey,
    }),
  );
}
