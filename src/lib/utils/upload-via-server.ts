import { parseJsonResponse } from "@/lib/utils/parse-json-response";
import type { UploadOptions, UploadResult } from "@/lib/utils/upload-types";

interface DirectUploadResponse {
  id: string;
  status: string;
  error?: string;
}

/**
 * Uploads through the Next.js API (no R2). Used on localhost when
 * R2 credentials are not set. Vercel body limit ~4.5 MB applies.
 */
export function uploadViaServer(
  file: File,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const uploadFile =
    file.name && file.name.trim().length > 0
      ? file
      : new File([file], "document.pdf", { type: file.type || "application/pdf" });

  const formData = new FormData();
  formData.append("file", uploadFile);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/documents/upload/direct", true);

    if (options.onProgress) {
      const onProgress = options.onProgress;
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress({
          ratio: event.total ? event.loaded / event.total : 0,
          loaded: event.loaded,
          total: event.total,
        });
      };
    }

    xhr.onload = async () => {
      try {
        const payload = JSON.parse(xhr.responseText) as DirectUploadResponse & {
          error?: string;
        };
        if (xhr.status >= 200 && xhr.status < 300) {
          options.onProgress?.({
            ratio: 1,
            loaded: uploadFile.size,
            total: uploadFile.size,
          });
          resolve({ id: payload.id, status: payload.status });
          return;
        }
        reject(
          new Error(
            payload.error ?? `Upload failed (${xhr.status}). Please try again.`,
          ),
        );
      } catch {
        reject(new Error(`Upload failed (${xhr.status}). Please try again.`));
      }
    };

    xhr.onerror = () =>
      reject(
        new Error(
          "Upload failed — could not reach the server. Check your connection and try again.",
        ),
      );
    xhr.ontimeout = () =>
      reject(new Error("Upload timed out. Please try again on a stronger connection."));
    xhr.onabort = () => reject(new Error("Upload was cancelled."));

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort();
        return;
      }
      options.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(formData);
  });
}
