import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import type { DocumentSummary } from "@/types";

function toSummary(doc: typeof documents.$inferSelect): DocumentSummary {
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
  };
}

export async function GET() {
  const rows = await db
    .select()
    .from(documents)
    .orderBy(desc(documents.createdAt));

  return NextResponse.json(rows.map(toSummary));
}
