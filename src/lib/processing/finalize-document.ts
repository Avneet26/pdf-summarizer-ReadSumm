import "server-only";

import { eq } from "drizzle-orm";

import { FAILURE_THRESHOLD } from "@/lib/constants";
import { db } from "@/lib/db";
import { cards, documents } from "@/lib/db/schema";

export async function finalizeDocumentIfComplete(
  documentId: string,
  successCount: number,
  totalChunks: number,
): Promise<"ready" | "summarizing" | "failed"> {
  const actualFailures = totalChunks - successCount;
  const failureRate = totalChunks > 0 ? actualFailures / totalChunks : 0;

  if (failureRate > FAILURE_THRESHOLD) {
    const message = `Too many chunks failed to summarize (${actualFailures}/${totalChunks}). Check your OpenRouter API key and model.`;
    await db
      .update(documents)
      .set({ status: "failed", errorMessage: message })
      .where(eq(documents.id, documentId));
    return "failed";
  }

  await db
    .update(documents)
    .set({
      status: "ready",
      processedCards: successCount,
      totalCards: successCount,
      errorMessage: null,
    })
    .where(eq(documents.id, documentId));

  console.log(
    `[PDF] Complete: ${documentId} — ${successCount} cards ready${actualFailures > 0 ? ` (${actualFailures} failed)` : ""}`,
  );

  return "ready";
}

export async function countProcessedCards(documentId: string): Promise<number> {
  const rows = await db
    .select({ id: cards.id })
    .from(cards)
    .where(eq(cards.documentId, documentId));
  return rows.length;
}
