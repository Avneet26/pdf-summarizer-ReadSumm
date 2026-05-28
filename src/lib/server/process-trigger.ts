import "server-only";

import { createHash } from "node:crypto";

import { getAppRefererUrl } from "@/lib/utils/app-url";

function processTriggerSecret(): string | undefined {
  const explicit = process.env.PROCESS_TRIGGER_SECRET?.trim();
  if (explicit) return explicit;

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (blobToken && process.env.VERCEL === "1") {
    return createHash("sha256").update(`pdf-process:${blobToken}`).digest("hex").slice(0, 32);
  }

  return undefined;
}

/** Base URL for server-to-server calls on Vercel or locally. */
export function getInternalAppUrl(): string {
  return getAppRefererUrl().replace(/\/$/, "");
}

export function authorizeProcessTrigger(request: Request): boolean {
  const secret = processTriggerSecret();
  if (secret) {
    return request.headers.get("x-process-trigger") === secret;
  }

  const host = request.headers.get("host") ?? "";
  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

/**
 * Starts PDF processing in a dedicated API route (normal serverless invocation).
 * Avoids loading pdf-parse inside Next.js after() on Vercel.
 */
export async function triggerDocumentProcessing(documentId: string): Promise<void> {
  const url = `${getInternalAppUrl()}/api/documents/${documentId}/process`;
  const secret = processTriggerSecret();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-process-trigger": secret } : {}),
    },
    body: JSON.stringify({ source: "upload-complete" }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Process trigger failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
  }
}
