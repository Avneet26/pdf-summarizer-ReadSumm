import "server-only";

import { createHash } from "node:crypto";

import { getR2SecretAccessKey } from "@/lib/storage/config";
import { getAppRefererUrl } from "@/lib/utils/app-url";

function continueSecret(): string | undefined {
  const explicit = process.env.CONTINUE_PROCESS_SECRET?.trim();
  if (explicit) return explicit;

  const secretAccessKey = getR2SecretAccessKey();
  if (secretAccessKey && process.env.VERCEL === "1") {
    return createHash("sha256")
      .update(`pdf-continue:${secretAccessKey}`)
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

function continueProcessBaseUrl(): string {
  if (process.env.VERCEL === "1") {
    // Chain within the same deployment (production or preview).
    const host = process.env.VERCEL_URL?.trim();
    if (host) {
      return `https://${host.replace(/^https?:\/\//, "")}`;
    }
    return getAppRefererUrl().replace(/\/$/, "");
  }

  // Local dev must chain to localhost — NEXT_PUBLIC_APP_URL is often production.
  const port = process.env.PORT?.trim() || "3000";
  return `http://127.0.0.1:${port}`;
}

/** Schedules the next summarization slice in a fresh serverless invocation. */
export async function triggerContinueProcessing(documentId: string): Promise<void> {
  const url = `${continueProcessBaseUrl()}/api/documents/${documentId}/continue`;
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
