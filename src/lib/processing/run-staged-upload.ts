import "server-only";

import { eq } from "drizzle-orm";

import { deleteStagedFile, downloadStagedFile } from "@/lib/storage/staged";
import { isStagedUploadPath } from "@/lib/storage/paths";
import { MAX_UPLOAD_BYTES, formatMaxUploadLimit } from "@/lib/constants";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { processDocument } from "@/lib/processing/process-document";
import { bufferHasPdfHeader } from "@/lib/utils/pdf-file";

/**
 * Downloads a staged R2 object, validates the PDF, runs the pipeline, then deletes it.
 */
export async function runStagedUploadProcessing(documentId: string): Promise<void> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    throw new Error("Unknown document.");
  }

  const objectPath = doc.uploadObjectPath?.trim();
  if (!objectPath || !isStagedUploadPath(objectPath)) {
    throw new Error("No staged upload found for this document.");
  }

  let buffer: Buffer;
  try {
    buffer = await downloadStagedFile(objectPath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read the uploaded file.";
    console.error(`[PDF] Download from R2 failed: ${message}`);
    await db
      .update(documents)
      .set({
        status: "failed",
        errorMessage: "Could not read the uploaded file. Please try again.",
        uploadObjectPath: null,
      })
      .where(eq(documents.id, documentId));
    return;
  }

  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    void deleteStagedFile(objectPath);
    await db
      .update(documents)
      .set({
        uploadObjectPath: null,
        status: "failed",
        errorMessage: `File exceeds the ${formatMaxUploadLimit()} upload limit.`,
      })
      .where(eq(documents.id, documentId));
    return;
  }

  if (!bufferHasPdfHeader(buffer)) {
    void deleteStagedFile(objectPath);
    await db
      .update(documents)
      .set({
        uploadObjectPath: null,
        status: "failed",
        errorMessage: "The uploaded file is not a PDF.",
      })
      .where(eq(documents.id, documentId));
    return;
  }

  console.log(
    `[PDF] Processing staged upload: ${documentId} (${(buffer.byteLength / 1024).toFixed(1)} KB)`,
  );

  await processDocument(documentId, buffer, doc.originalFilename, {
    // Delete object right after extract/chunk so large books don't hold storage + memory.
    onExtracted: async () => {
      await deleteStagedFile(objectPath);
      await db
        .update(documents)
        .set({ uploadObjectPath: null })
        .where(eq(documents.id, documentId));
      console.log(`[PDF] Cleaned up staged file for ${documentId}`);
    },
  });
}
