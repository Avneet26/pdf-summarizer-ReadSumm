import { upload } from "@vercel/blob/client";

import { parseJsonResponse } from "@/lib/utils/parse-json-response";
import type { UploadOptions, UploadResult } from "@/lib/utils/upload-types";

interface PrepareResponse {
  documentId: string;
  pathname: string;
  error?: string;
}

interface CompleteResponse {
  id: string;
  status: string;
  error?: string;
}

/**
 * Client upload via Vercel Blob (prepare → direct browser upload → complete).
 * Works on Vercel production without Firebase or bucket CORS setup.
 */
export async function uploadViaBlob(
  file: File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const uploadFile =
    file.name && file.name.trim().length > 0
      ? file
      : new File([file], "document.pdf", { type: file.type || "application/pdf" });

  const prepareRes = await fetch("/api/documents/upload/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: uploadFile.name,
      contentType: uploadFile.type || "application/pdf",
      size: uploadFile.size,
    }),
    signal: options.signal,
  });

  const prepare = await parseJsonResponse<PrepareResponse>(prepareRes);
  if (!prepareRes.ok) {
    throw new Error(prepare.error ?? `Could not prepare upload (${prepareRes.status}).`);
  }

  const blob = await upload(prepare.pathname, uploadFile, {
    access: "private",
    handleUploadUrl: "/api/documents/upload/blob",
    clientPayload: JSON.stringify({ documentId: prepare.documentId }),
    multipart: uploadFile.size > 4.5 * 1024 * 1024,
    abortSignal: options.signal,
    onUploadProgress: options.onProgress
      ? ({ loaded, total, percentage }) => {
          options.onProgress?.({
            loaded,
            total,
            ratio: percentage / 100,
          });
        }
      : undefined,
  });

  const completeRes = await fetch("/api/documents/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: prepare.documentId,
      blobUrl: blob.url,
    }),
    signal: options.signal,
  });

  const complete = await parseJsonResponse<CompleteResponse>(completeRes);
  if (!completeRes.ok) {
    throw new Error(
      complete.error ?? `Upload finalization failed (${completeRes.status}).`,
    );
  }

  return { id: complete.id, status: complete.status };
}
