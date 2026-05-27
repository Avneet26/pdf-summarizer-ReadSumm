import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { SINGLE_USER_ID } from "@/lib/constants";
import { db } from "@/lib/db";
import { documents, readingProgress } from "@/lib/db/schema";
import type { DocumentSummary } from "@/types";

function toSummary(
  doc: typeof documents.$inferSelect,
  lastCardIndex: number | null,
): DocumentSummary {
  return {
    id: doc.id,
    title: doc.title,
    originalFilename: doc.originalFilename,
    pageCount: doc.pageCount,
    status: doc.status,
    totalCards: doc.totalCards,
    processedCards: doc.processedCards,
    errorMessage: doc.errorMessage,
    chunkStrategy: doc.chunkStrategy,
    accentColor: doc.accentColor,
    createdAt: doc.createdAt,
    lastCardIndex,
  };
}

export async function GET() {
  const rows = await db
    .select({
      document: documents,
      lastCardIndex: readingProgress.lastCardIndex,
    })
    .from(documents)
    .leftJoin(
      readingProgress,
      and(
        eq(readingProgress.documentId, documents.id),
        eq(readingProgress.userId, SINGLE_USER_ID),
      ),
    )
    .orderBy(desc(documents.createdAt));

  return NextResponse.json(
    rows.map((row) => toSummary(row.document, row.lastCardIndex ?? null)),
  );
}
