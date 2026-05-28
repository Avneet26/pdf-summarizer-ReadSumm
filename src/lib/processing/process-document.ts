import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { extractAndChunkDocument } from "@/lib/processing/extract-and-chunk";
import {
  createProcessingDeadline,
  getProcessingTimeBudgetMs,
} from "@/lib/processing/processing-config";
import { runSummarizationStep } from "@/lib/processing/summarize-chunks";
import { triggerContinueProcessing } from "@/lib/server/continue-trigger";

interface ProcessOptions {
  onExtracted?: () => Promise<void> | void;
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
    await extractAndChunkDocument(documentId, pdfBuffer, originalFilename);

    if (options.onExtracted) {
      await options.onExtracted();
    }

    const deadline = createProcessingDeadline();
    const result = await runSummarizationStep(documentId, deadline);

    if (!result.done) {
      console.log(
        `[PDF] Pausing ${documentId} at ${result.processedCards}/${result.totalCards} cards — scheduling continue`,
      );
      await triggerContinueProcessing(documentId);
    }

    const elapsed = ((Date.now() - pipelineStart) / 1000).toFixed(1);
    console.log(
      `[PDF] Invocation finished in ${elapsed}s (budget ${getProcessingTimeBudgetMs() / 1000}s, done=${result.done})`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown processing error.";
    console.error(`[PDF] Failed (${documentId}): ${message}`);

    await db
      .update(documents)
      .set({ status: "failed", errorMessage: message })
      .where(eq(documents.id, documentId));
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

/** Resume summarization for a document already extracted and chunked. */
export async function continueDocumentProcessing(documentId: string) {
  const deadline = createProcessingDeadline();
  const result = await runSummarizationStep(documentId, deadline);

  if (!result.done) {
    console.log(
      `[PDF] Continue pause ${documentId} at ${result.processedCards}/${result.totalCards}`,
    );
    await triggerContinueProcessing(documentId);
  }

  return result;
}
