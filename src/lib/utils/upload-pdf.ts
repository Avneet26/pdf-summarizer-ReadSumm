import { preferServerUpload } from "@/lib/utils/upload-strategy";
import { uploadViaBlob } from "@/lib/utils/upload-via-blob";
import { uploadViaServer } from "@/lib/utils/upload-via-server";

export type { UploadOptions, UploadProgress, UploadResult } from "@/lib/utils/upload-types";

/**
 * Uploads a PDF:
 * - Localhost: same-origin server upload (no Blob token required)
 * - Vercel / production: Vercel Blob client upload (prepare → blob → complete)
 */
export async function uploadPdf(
  file: File,
  options: import("@/lib/utils/upload-types").UploadOptions = {},
) {
  if (preferServerUpload()) {
    return uploadViaServer(file, options);
  }

  return uploadViaBlob(file, options);
}
