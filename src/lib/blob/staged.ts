import "server-only";

import { del, get } from "@vercel/blob";

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export async function downloadStagedBlob(blobUrl: string): Promise<Buffer> {
  const result = await get(blobUrl, { access: "private" });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error("Could not read the uploaded file from storage.");
  }

  return streamToBuffer(result.stream);
}

export async function deleteStagedBlob(blobUrl: string): Promise<void> {
  try {
    await del(blobUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Blob] Failed to delete staged file: ${message}`);
  }
}
