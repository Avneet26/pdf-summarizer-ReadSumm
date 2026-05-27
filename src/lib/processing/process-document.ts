import "server-only";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  generateCard,
  generateCardsBatch,
} from "@/lib/ai/openrouter";
import {
  getOpenRouterBatchSize,
  getOpenRouterConcurrency,
} from "@/lib/ai/config";
import { AI_MAX_RETRIES, FAILURE_THRESHOLD } from "@/lib/constants";
import { db } from "@/lib/db";
import { cards, chunks, documents } from "@/lib/db/schema";
import { chunkPdfText } from "@/lib/pdf/chunk";
import { extractPdfText } from "@/lib/pdf/extract";
import { groupIntoBatches, runPool } from "@/lib/utils/concurrency-pool";
import { ProgressFlusher } from "@/lib/utils/progress-flusher";

type ChunkRow = {
  id: string;
  documentId: string;
  orderIndex: number;
  label: string;
  sourcePages: string;
  rawText: string;
};

type BatchResult = { ok: true; count: number } | { ok: false; count: number };

async function updateDocumentStatus(
  documentId: string,
  updates: Partial<typeof documents.$inferInsert>,
) {
  if (updates.status) {
    console.log(`[PDF] ${documentId} → status: ${updates.status}`);
  }
  await db.update(documents).set(updates).where(eq(documents.id, documentId));
}

async function generateWithRetry(
  title: string,
  label: string,
  rawText: string,
) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      return await generateCard(title, label, rawText);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < AI_MAX_RETRIES) {
        console.log(
          `[PDF] Retrying "${label}" (attempt ${attempt + 2}/${AI_MAX_RETRIES + 1}): ${lastError.message}`,
        );
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

async function processBatchFallback(
  title: string,
  batch: ChunkRow[],
  progress: ProgressFlusher,
): Promise<BatchResult> {
  console.log(
    `[PDF] Batch fallback → processing ${batch.length} cards individually in parallel`,
  );

  const results = await Promise.all(
    batch.map(async (chunk) => {
      try {
        const generated = await generateWithRetry(title, chunk.label, chunk.rawText);
        await saveCards(chunk.documentId, [chunk], [generated]);
        progress.increment(1);
        console.log(
          `[PDF] Card ${chunk.orderIndex + 1} done — "${generated.subtitle}"`,
        );
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[PDF] Card failed — "${chunk.label}": ${message}`);
        return false;
      }
    }),
  );

  const successes = results.filter(Boolean).length;
  return successes === batch.length
    ? { ok: true, count: successes }
    : { ok: false, count: successes };
}

async function processChunkBatch(
  title: string,
  batch: ChunkRow[],
  batchIndex: number,
  totalBatches: number,
  progress: ProgressFlusher,
): Promise<BatchResult> {
  const labels = batch.map((c) => c.label).join(", ");
  console.log(
    `[PDF] Batch ${batchIndex + 1}/${totalBatches} (${batch.length} cards): ${labels}`,
  );

  try {
    const generated = await generateCardsBatch(
      title,
      batch.map((c) => ({ label: c.label, text: c.rawText })),
    );
    await saveCards(batch[0].documentId, batch, generated);
    progress.increment(batch.length);
    return { ok: true, count: batch.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[PDF] Batch ${batchIndex + 1} failed (${message}), falling back…`,
    );
    return processBatchFallback(title, batch, progress);
  }
}

interface ProcessOptions {
  /**
   * Invoked once processing finishes (whether it succeeded or failed) so the
   * caller can clean up any staged uploads / temp storage. Failures inside
   * the callback are swallowed so they cannot mask the real result.
   */
  onFinished?: () => Promise<void> | void;
}

export async function processDocument(
  documentId: string,
  pdfBuffer: Buffer,
  originalFilename: string,
  options: ProcessOptions = {},
) {
  const pipelineStart = Date.now();
  console.log(`[PDF] Processing started: ${originalFilename} (${documentId})`);

  try {
    await updateDocumentStatus(documentId, { status: "extracting" });

    const extracted = await extractPdfText(pdfBuffer);
    console.log(
      `[PDF] Extracted ${extracted.pageCount} pages from "${originalFilename}"`,
    );

    const title =
      originalFilename.replace(/\.pdf$/i, "").replace(/[_-]/g, " ").trim() ||
      "Untitled Document";

    await updateDocumentStatus(documentId, {
      title,
      pageCount: extracted.pageCount,
      status: "chunking",
    });

    const { chunks: textChunks, strategy } = chunkPdfText(extracted.pages);
    console.log(
      `[PDF] Chunked into ${textChunks.length} sections (strategy: ${strategy})`,
    );

    if (textChunks.length === 0) {
      throw new Error("No readable content could be extracted from this PDF.");
    }

    await db.delete(chunks).where(eq(chunks.documentId, documentId));
    await db.delete(cards).where(eq(cards.documentId, documentId));

    const chunkRows: ChunkRow[] = textChunks.map((chunk, orderIndex) => ({
      id: nanoid(),
      documentId,
      orderIndex,
      label: chunk.label,
      sourcePages: chunk.sourcePages,
      rawText: chunk.rawText,
    }));

    await db.insert(chunks).values(chunkRows);

    const batchSize = getOpenRouterBatchSize();
    const batches = groupIntoBatches(chunkRows, batchSize);
    const concurrency = getOpenRouterConcurrency(batches.length);

    await updateDocumentStatus(documentId, {
      status: "summarizing",
      chunkStrategy: strategy,
      totalCards: chunkRows.length,
      processedCards: 0,
      errorMessage: null,
    });

    console.log(
      `[PDF] Summarizing ${chunkRows.length} cards — ${batches.length} API batches, concurrency ${concurrency}, batch size ${batchSize}`,
    );

    const progress = new ProgressFlusher(documentId);

    await runPool(batches, concurrency, async (batch, batchIndex) =>
      processChunkBatch(title, batch, batchIndex, batches.length, progress),
    );

    const successCount = await progress.finalize();
    const actualFailures = chunkRows.length - successCount;
    const failureRate = actualFailures / chunkRows.length;

    if (failureRate > FAILURE_THRESHOLD) {
      throw new Error(
        `Too many chunks failed to summarize (${actualFailures}/${chunkRows.length}). Check your OpenRouter API key and model.`,
      );
    }

    await updateDocumentStatus(documentId, {
      status: "ready",
      processedCards: successCount,
      totalCards: successCount,
    });

    const elapsed = ((Date.now() - pipelineStart) / 1000).toFixed(1);
    console.log(
      `[PDF] Complete in ${elapsed}s: "${title}" — ${successCount} cards ready${actualFailures > 0 ? ` (${actualFailures} failed)` : ""}`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown processing error.";
    console.error(`[PDF] Failed (${documentId}): ${message}`);
    await updateDocumentStatus(documentId, {
      status: "failed",
      errorMessage: message,
    });
  } finally {
    if (options.onFinished) {
      try {
        await options.onFinished();
      } catch (cleanupError) {
        const message =
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError);
        console.warn(`[PDF] Cleanup hook failed for ${documentId}: ${message}`);
      }
    }
  }
}
