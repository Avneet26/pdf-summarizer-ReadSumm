import "server-only";

import { nanoid } from "nanoid";
import { getUploadBucket } from "./admin";

const UPLOAD_PREFIX = "uploads";
const SIGN_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface SignedUploadTarget {
  objectPath: string;
  uploadUrl: string;
  expiresAt: string;
}

function safeFilename(name: string): string {
  // Keep it human-readable in the bucket UI but strip slashes and control chars
  return name.replace(/[\\/\u0000-\u001f]+/g, "_").slice(0, 120) || "upload.pdf";
}

export function buildObjectPath(documentId: string, filename: string): string {
  return `${UPLOAD_PREFIX}/${documentId}/${safeFilename(filename)}`;
}

/**
 * Creates a v4 signed URL that lets the browser PUT the file straight to
 * Firebase Storage, bypassing the Vercel function body-size cap.
 */
export async function createSignedUploadUrl(
  objectPath: string,
  contentType: string,
): Promise<SignedUploadTarget> {
  const bucket = getUploadBucket();
  const file = bucket.file(objectPath);
  const expiresAt = Date.now() + SIGN_TTL_MS;

  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: expiresAt,
    contentType,
  });

  return {
    objectPath,
    uploadUrl,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

/** Streams the uploaded object into a Buffer for processing. */
export async function downloadUpload(objectPath: string): Promise<Buffer> {
  const bucket = getUploadBucket();
  const [buffer] = await bucket.file(objectPath).download();
  return buffer;
}

/**
 * Best-effort deletion of a staged upload object. Never throws so we don't
 * mask the real processing result if cleanup happens to fail.
 */
export async function deleteUpload(objectPath: string): Promise<void> {
  try {
    const bucket = getUploadBucket();
    await bucket.file(objectPath).delete({ ignoreNotFound: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Firebase] Failed to delete ${objectPath}: ${message}`);
  }
}

export function newDocumentId(): string {
  return nanoid();
}
