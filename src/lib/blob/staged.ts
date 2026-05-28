import "server-only";

import { del, get, getDownloadUrl } from "@vercel/blob";

const DOWNLOAD_RETRIES = 3;
const DOWNLOAD_RETRY_MS = 400;

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const parts: Buffer[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    const buf = Buffer.from(value);
    parts.push(buf);
    totalLength += buf.length;
  }

  return Buffer.concat(parts, totalLength);
}

async function downloadViaGet(blobUrl: string): Promise<Buffer> {
  const result = await get(blobUrl, { access: "private" });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Could not read the uploaded file from storage.");
  }

  return streamToBuffer(result.stream);
}

async function downloadViaSignedUrl(blobUrl: string): Promise<Buffer> {
  const downloadUrl = getDownloadUrl(blobUrl);
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Blob download failed (${response.status}).`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function downloadStagedBlob(blobUrl: string): Promise<Buffer> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < DOWNLOAD_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_RETRY_MS * attempt));
    }

    try {
      return await downloadViaGet(blobUrl);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    try {
      return await downloadViaSignedUrl(blobUrl);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("Could not read the uploaded file from storage.");
}

export async function deleteStagedBlob(blobUrl: string): Promise<void> {
  try {
    await del(blobUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Blob] Failed to delete staged file: ${message}`);
  }
}
