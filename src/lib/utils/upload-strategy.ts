import { isBlobConfigured } from "@/lib/blob/config";

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * Whether to upload via POST /api/documents/upload/direct (same-origin).
 * - Browser: only on localhost (production must use Vercel Blob client upload).
 * - Server: when Blob token is missing (e.g. local dev without vercel env pull).
 *
 * BLOB_READ_WRITE_TOKEN is server-only — never use isBlobConfigured() in the
 * browser or production would always pick direct upload and hit Vercel's 4.5MB cap.
 */
export function preferServerUpload(): boolean {
  if (process.env.NEXT_PUBLIC_UPLOAD_VIA_SERVER === "true") return true;
  if (process.env.NEXT_PUBLIC_UPLOAD_VIA_SERVER === "false") return false;

  if (typeof window !== "undefined") {
    return isLocalHostname(window.location.hostname);
  }

  return !isBlobConfigured();
}
