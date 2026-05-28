import { isBlobConfigured } from "@/lib/blob/config";
import { preferServerUpload } from "@/lib/utils/upload-strategy";
import { uploadViaBlob } from "@/lib/utils/upload-via-blob";
import { uploadViaServer } from "@/lib/utils/upload-via-server";

export type { UploadOptions, UploadProgress, UploadResult } from "@/lib/utils/upload-types";

/**
 * Uploads a PDF:
 * - Local / no Blob token: same-origin server upload
 * - Vercel / production: Vercel Blob client upload (large files supported)
 */
export async function uploadPdf(
  file: File,
  options: import("@/lib/utils/upload-types").UploadOptions = {},
) {
  if (preferServerUpload()) {
    return uploadViaServer(file, options);
  }

  if (!isBlobConfigured()) {
    throw new Error(
      "Upload storage is not configured. On Vercel, add a Blob store to the project. Locally, use direct upload or run `vercel env pull`.",
    );
  }

  return uploadViaBlob(file, options);
}
