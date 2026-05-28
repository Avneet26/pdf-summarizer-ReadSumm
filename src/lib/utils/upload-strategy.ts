import { isStorageConfigured } from "@/lib/storage/config";

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function r2UploadsEnabledInBrowser(): boolean {
  return process.env.NEXT_PUBLIC_R2_UPLOADS_ENABLED === "true";
}

/**
 * Whether to upload via POST /api/documents/upload/direct (same-origin).
 * - Browser on localhost: direct upload only when R2 is not configured.
 * - Browser on production: always use R2 presigned URL upload.
 * - Server: when R2 credentials are missing.
 *
 * R2 credentials are server-only — the browser uses NEXT_PUBLIC_R2_UPLOADS_ENABLED
 * (set at build/dev startup from server env in next.config.ts).
 */
export function preferServerUpload(): boolean {
  if (process.env.NEXT_PUBLIC_UPLOAD_VIA_SERVER === "true") return true;
  if (process.env.NEXT_PUBLIC_UPLOAD_VIA_SERVER === "false") return false;

  if (typeof window !== "undefined") {
    if (isLocalHostname(window.location.hostname)) {
      return !r2UploadsEnabledInBrowser();
    }
    return false;
  }

  return !isStorageConfigured();
}
