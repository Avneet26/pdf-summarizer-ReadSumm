import { parseJsonResponse } from "@/lib/utils/parse-json-response";

interface SignResponse {
  documentId: string;
  objectPath: string;
  uploadUrl: string;
  contentType: string;
}

interface CompleteResponse {
  id: string;
  status: string;
}

export interface UploadProgress {
  /** Fraction in [0, 1]. */
  ratio: number;
  loaded: number;
  total: number;
}

export interface UploadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
}

/**
 * Uploads a PDF to Firebase Storage using a server-issued signed URL, then
 * tells the server to fetch + process it. The Vercel function never sees the
 * file bytes, so we are not bound by its body-size limit.
 */
export async function uploadViaFirebase(
  file: File,
  options: UploadOptions = {},
): Promise<CompleteResponse> {
  const sign = await requestSignedUrl(file, options.signal);
  await putToFirebase(file, sign, options);
  return completeUpload(sign.documentId, options.signal);
}

async function requestSignedUrl(
  file: File,
  signal?: AbortSignal,
): Promise<SignResponse> {
  const response = await fetch("/api/documents/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/pdf",
      size: file.size,
    }),
    signal,
  });

  const payload = await parseJsonResponse<SignResponse & { error?: string }>(
    response,
  );
  if (!response.ok) {
    throw new Error(payload.error ?? `Could not prepare upload (${response.status}).`);
  }
  return payload;
}

function putToFirebase(
  file: File,
  sign: SignResponse,
  options: UploadOptions,
): Promise<void> {
  // We use XMLHttpRequest (not fetch) because fetch does not expose
  // upload progress events, which mobile users rely on to know the
  // transfer is still happening.
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", sign.uploadUrl, true);
    xhr.setRequestHeader("Content-Type", sign.contentType);

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

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.({ ratio: 1, loaded: file.size, total: file.size });
        resolve();
      } else {
        reject(
          new Error(
            xhr.status === 0
              ? "Upload failed — your connection may have dropped. Please try again."
              : `Upload to storage failed (${xhr.status}). Please try again.`,
          ),
        );
      }
    };

    xhr.onerror = () =>
      reject(
        new Error(
          "Upload failed — your connection may have dropped. Please try again.",
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

    xhr.send(file);
  });
}

async function completeUpload(
  documentId: string,
  signal?: AbortSignal,
): Promise<CompleteResponse> {
  const response = await fetch("/api/documents/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId }),
    signal,
  });

  const payload = await parseJsonResponse<CompleteResponse & { error?: string }>(
    response,
  );
  if (!response.ok) {
    throw new Error(payload.error ?? `Upload finalization failed (${response.status}).`);
  }
  return payload;
}
