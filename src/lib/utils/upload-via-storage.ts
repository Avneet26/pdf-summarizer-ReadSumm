import { parseJsonResponse } from "@/lib/utils/parse-json-response";
import type { UploadOptions, UploadProgress, UploadResult } from "@/lib/utils/upload-types";

interface PrepareResponse {
  documentId: string;
  pathname: string;
  uploadUrl: string;
  error?: string;
}

interface CompleteResponse {
  id: string;
  status: string;
  error?: string;
}

function putWithProgress(
  url: string,
  file: File,
  options: { signal?: AbortSignal; onProgress?: (progress: UploadProgress) => void },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/pdf");

    if (options.signal) {
      if (options.signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      options.signal.addEventListener(
        "abort",
        () => {
          xhr.abort();
        },
        { once: true },
      );
    }

    xhr.upload.onprogress = (event) => {
      if (!options.onProgress || !event.lengthComputable) return;
      options.onProgress({
        loaded: event.loaded,
        total: event.total,
        ratio: event.total > 0 ? event.loaded / event.total : 0,
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`Upload to storage failed (${xhr.status}).`));
    };

    xhr.onerror = () => reject(new Error("Upload to storage failed."));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    xhr.send(file);
  });
}

/**
 * Client upload via Cloudflare R2 (prepare → presigned PUT → complete).
 */
export async function uploadViaStorage(
  file: File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const uploadFile =
    file.name && file.name.trim().length > 0
      ? file
      : new File([file], "document.pdf", { type: file.type || "application/pdf" });

  const contentType = uploadFile.type || "application/pdf";

  const prepareRes = await fetch("/api/documents/upload/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: uploadFile.name,
      contentType,
      size: uploadFile.size,
    }),
    signal: options.signal,
  });

  const prepare = await parseJsonResponse<PrepareResponse>(prepareRes);
  if (!prepareRes.ok) {
    throw new Error(prepare.error ?? `Could not prepare upload (${prepareRes.status}).`);
  }

  try {
    await putWithProgress(prepare.uploadUrl, uploadFile, {
      signal: options.signal,
      onProgress: options.onProgress,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload to storage failed.";
    throw new Error(
      message.includes("storage") || message.includes("R2")
        ? message
        : `Upload to storage failed: ${message}`,
    );
  }

  const completeRes = await fetch("/api/documents/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: prepare.documentId,
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
