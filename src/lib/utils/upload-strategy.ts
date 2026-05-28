import { isBlobConfigured } from "@/lib/blob/config";

/** Same-origin upload when local or when Blob token is missing. */
export function preferServerUpload(): boolean {
  if (process.env.NEXT_PUBLIC_UPLOAD_VIA_SERVER === "true") return true;
  if (process.env.NEXT_PUBLIC_UPLOAD_VIA_SERVER === "false") return false;
  if (!isBlobConfigured()) return true;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}
