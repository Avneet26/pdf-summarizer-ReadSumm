import "server-only";

import { asc, eq } from "drizzle-orm";

import {
  generateCard,
  generateCardsBatch,
} from "@/lib/ai/openrouter";
import {
  getOpenRouterBatchSize,
  getOpenRouterConcurrency,
} from "@/lib/ai/config";
import { AI_MAX_RETRIES } from "@/lib/constants";
import { db } from "@/lib/db";
import { cards, chunks, documents } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { groupIntoBatches } from "@/lib/utils/concurrency-pool";
import { ProgressFlusher } from "@/lib/utils/progress-flusher";
import {
  countProcessedCards,
  finalizeDocumentIfComplete,
} from "@/lib/processing/finalize-document";

type ChunkRow = {
  id: string;
  documentId: string;
  orderIndex: number;
  label: string;
  sourcePages: string;
  rawText: string;
};

async function generateWithRetry(title: string, label: string, rawText: string) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      return await generateCard(title, label, rawText);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < AI_MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error("Failed to generate card.");
}

async function saveCards(
  documentId: string,
  chunkBatch: ChunkRow[],
  generated: Array<{ subtitle: string; body: string; wordCount: number }>,
) {
  await db.insert(cards).values(
    chunkBatch.map((chunk, i) => ({
      id: nanoid(),
      chunkId: chunk.id,
      documentId,
      orderIndex: chunk.orderIndex,
      subtitle: generated[i].subtitle,
      body: generated[i].body,
      wordCount: generated[i].wordCount,
    })),
  );
}

async function processOneBatch(
  title: string,
  batch: ChunkRow[],
  batchIndex: number,
  totalBatches: number,
  progress: ProgressFlusher,
): Promise<number> {
  console.log(
    `[PDF] Batch ${batchIndex + 1}/${totalBatches} (${batch.length} cards): ${batch.map((c) => c.label).join(", ")}`,
  );

  try {
    const generated = await generateCardsBatch(
      title,
      batch.map((c) => ({ label: c.label, text: c.rawText })),
    );
    await saveCards(batch[0].documentId, batch, generated);
    progress.increment(batch.length);
    return batch.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[PDF] Batch ${batchIndex + 1} failed (${message}), falling back…`);

    let successes = 0;
    for (const chunk of batch) {
      try {
        const generated = await generateWithRetry(title, chunk.label, chunk.rawText);
        await saveCards(chunk.documentId, [chunk], [generated]);
        progress.increment(1);
        successes += 1;
      } catch (inner) {
        const innerMsg = inner instanceof Error ? inner.message : String(inner);
        console.error(`[PDF] Card failed — "${chunk.label}": ${innerMsg}`);
      }
    }
    return successes;
  }
}

/** Summarizes all pending chunks for a document in a single run. */
export async function runSummarization(documentId: string): Promise<void> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    throw new Error("Unknown document.");
  }

  if (doc.status !== "summarizing") {
    return;
  }

  const chunkRows = await db
    .select()
    .from(chunks)
    .where(eq(chunks.documentId, documentId))
    .orderBy(asc(chunks.orderIndex));

  const existingCards = await db
    .select({ chunkId: cards.chunkId })
    .from(cards)
    .where(eq(cards.documentId, documentId));

  const doneChunkIds = new Set(existingCards.map((row) => row.chunkId));
  const pending = chunkRows.filter((chunk) => !doneChunkIds.has(chunk.id));

  if (pending.length === 0) {
    const processed = await countProcessedCards(documentId);
    await finalizeDocumentIfComplete(documentId, processed, chunkRows.length);
    return;
  }

  const batchSize = getOpenRouterBatchSize();
  const batches = groupIntoBatches(pending, batchSize);
  const concurrency = getOpenRouterConcurrency(batches.length);
  const progress = new ProgressFlusher(documentId);
  const title = doc.title;

  console.log(
    `[PDF] Summarizing ${documentId}: ${pending.length} cards in ${batches.length} batches`,
  );

  let batchIndex = 0;
  while (batchIndex < batches.length) {
    const slice = batches.slice(batchIndex, batchIndex + concurrency);
    await Promise.all(
      slice.map((batch, offset) =>
        processOneBatch(title, batch, batchIndex + offset, batches.length, progress),
      ),
    );
    batchIndex += slice.length;
  }

  const processed = await progress.finalize();
  await finalizeDocumentIfComplete(documentId, processed, chunkRows.length);
}
