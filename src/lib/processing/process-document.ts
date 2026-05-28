import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { extractAndChunkDocument } from "@/lib/processing/extract-and-chunk";
import { runSummarization } from "@/lib/processing/summarize-chunks";

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

    await runSummarization(documentId);

    const elapsed = ((Date.now() - pipelineStart) / 1000).toFixed(1);
    console.log(`[PDF] Processing finished in ${elapsed}s (${documentId})`);
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
