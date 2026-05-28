import "server-only";

import { eq } from "drizzle-orm";

import { deleteStagedBlob, downloadStagedBlob } from "@/lib/blob/staged";
import { MAX_UPLOAD_BYTES, formatMaxUploadLimit } from "@/lib/constants";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { processDocument } from "@/lib/processing/process-document";
import { bufferHasPdfHeader } from "@/lib/utils/pdf-file";

/**
 * Downloads a staged Blob, validates the PDF, runs the full pipeline, then deletes the blob.
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

  const blobUrl = doc.uploadObjectPath?.trim();
  if (!blobUrl || !blobUrl.startsWith("http")) {
    throw new Error("No staged upload found for this document.");
  }

  let buffer: Buffer;
  try {
    buffer = await downloadStagedBlob(blobUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read the uploaded file.";
    console.error(`[PDF] Download from Blob failed: ${message}`);
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
    void deleteStagedBlob(blobUrl);
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
    void deleteStagedBlob(blobUrl);
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
    onFinished: async () => {
      await deleteStagedBlob(blobUrl);
      await db
        .update(documents)
        .set({ uploadObjectPath: null })
        .where(eq(documents.id, documentId));
      console.log(`[PDF] Cleaned up staged blob for ${documentId}`);
    },
  });
}
