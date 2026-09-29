import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl as createSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { env } from "@/config/env";

export const s3 = new S3Client({
  endpoint: env.s3.endpoint,
  region: env.s3.region,
  forcePathStyle: env.s3.forcePathStyle,
  // Supabase Storage implements the S3 protocol but may return a non-AWS
  // response to the SDK's newer default CRC32 checksum behavior.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: env.s3.accessKeyId,
    secretAccessKey: env.s3.secretAccessKey,
  },
});

export interface UploadResult {
  key: string;
  url: string;
}

// Uploads a buffer to object storage under a namespaced, random key so
// audio binaries never live in the database — only metadata + this URL do.
export async function uploadObject(
  buffer: Buffer,
  opts: { folder: "audio" | "artwork" | "avatars"; extension: string; contentType: string }
): Promise<UploadResult> {
  const extension = opts.extension.replace(/^\./, "").toLowerCase();
  if (!/^[a-z0-9]{1,8}$/.test(extension)) throw new Error("Unsupported storage object extension");
  const key = `${opts.folder}/${randomUUID()}.${extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: opts.contentType,
    })
  );

  return { key, url: `${env.s3.publicBaseUrl}/${key}` };
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.s3.bucket, Key: key }));
}

export async function getSignedObjectUrl(key: string, expiresInSeconds = 900): Promise<string> {
  return createSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }),
    { expiresIn: Math.min(Math.max(expiresInSeconds, 1), 3600) }
  );
}

export async function getObject(key: string) {
  return s3.send(new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }));
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: env.s3.bucket, Key: key }));
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "name" in error && error.name === "NotFound") return false;
    throw error;
  }
}

export function getStorageKeyFromUrl(url: string): string | undefined {
  const baseUrl = env.s3.publicBaseUrl.replace(/\/$/, "");
  if (!url.startsWith(`${baseUrl}/`)) return undefined;
  const key = decodeURIComponent(url.slice(baseUrl.length + 1));
  if (!/^(audio|artwork|avatars)\/[A-Za-z0-9._-]+$/.test(key)) return undefined;
  return key;
}
