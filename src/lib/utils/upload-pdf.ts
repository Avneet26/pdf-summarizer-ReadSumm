import { preferServerUpload } from "@/lib/utils/upload-strategy";
import { uploadViaStorage } from "@/lib/utils/upload-via-storage";
import { uploadViaServer } from "@/lib/utils/upload-via-server";

export type { UploadOptions, UploadProgress, UploadResult } from "@/lib/utils/upload-types";

/**
 * Uploads a PDF:
 * - Localhost: same-origin server upload (no R2 credentials required)
 * - Vercel / production: Cloudflare R2 presigned upload (prepare → PUT → complete)
 */
export async function uploadPdf(
  file: File,
  options: import("@/lib/utils/upload-types").UploadOptions = {},
) {
  if (preferServerUpload()) {
    return uploadViaServer(file, options);
  }

  return uploadViaStorage(file, options);
}
