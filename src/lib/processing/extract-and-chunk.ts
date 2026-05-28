import "server-only";

import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/lib/db";
import { cards, chunks, documents } from "@/lib/db/schema";
import { chunkPdfText } from "@/lib/pdf/chunk";
import { extractPdfText } from "@/lib/pdf/extract";

export async function extractAndChunkDocument(
  documentId: string,
  pdfBuffer: Buffer,
  originalFilename: string,
): Promise<{ totalChunks: number; title: string }> {
  await db
    .update(documents)
    .set({ status: "extracting" })
    .where(eq(documents.id, documentId));

  const extracted = await extractPdfText(pdfBuffer);
  console.log(
    `[PDF] Extracted ${extracted.pageCount} pages from "${originalFilename}"`,
  );

  const title =
    originalFilename.replace(/\.pdf$/i, "").replace(/[_-]/g, " ").trim() ||
    "Untitled Document";

  await db
    .update(documents)
    .set({ title, pageCount: extracted.pageCount, status: "chunking" })
    .where(eq(documents.id, documentId));

  const { chunks: textChunks, strategy } = chunkPdfText(extracted.pages);
  console.log(
    `[PDF] Chunked into ${textChunks.length} sections (strategy: ${strategy})`,
  );

  if (textChunks.length === 0) {
    throw new Error("No readable content could be extracted from this PDF.");
  }

  await db.delete(chunks).where(eq(chunks.documentId, documentId));
  await db.delete(cards).where(eq(cards.documentId, documentId));

  await db.insert(chunks).values(
    textChunks.map((chunk, orderIndex) => ({
      id: nanoid(),
      documentId,
      orderIndex,
      label: chunk.label,
      sourcePages: chunk.sourcePages,
      rawText: chunk.rawText,
    })),
  );

  await db
    .update(documents)
    .set({
      status: "summarizing",
      chunkStrategy: strategy,
      totalCards: textChunks.length,
      processedCards: 0,
      errorMessage: null,
    })
    .where(eq(documents.id, documentId));

  return { totalChunks: textChunks.length, title };
}
