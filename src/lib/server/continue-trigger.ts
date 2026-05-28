import "server-only";

import { createHash } from "node:crypto";

import { getAppRefererUrl } from "@/lib/utils/app-url";

function continueSecret(): string | undefined {
  const explicit = process.env.CONTINUE_PROCESS_SECRET?.trim();
  if (explicit) return explicit;

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (blobToken && process.env.VERCEL === "1") {
    return createHash("sha256")
      .update(`pdf-continue:${blobToken}`)
      .digest("hex")
      .slice(0, 32);
  }

  return undefined;
}

export function authorizeContinueRequest(request: Request): boolean {
  const secret = continueSecret();
  if (secret) {
    return request.headers.get("x-continue-process") === secret;
  }

  const host = request.headers.get("host") ?? "";
  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

/** Schedules the next summarization slice in a fresh serverless invocation. */
export async function triggerContinueProcessing(documentId: string): Promise<void> {
  const url = `${getAppRefererUrl().replace(/\/$/, "")}/api/documents/${documentId}/continue`;
  const secret = continueSecret();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "x-continue-process": secret } : {}),
    },
    body: JSON.stringify({ source: "chain" }),
  });

  if (!response.ok && response.status !== 202) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Continue trigger failed (${response.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
  }
}
