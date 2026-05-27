import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import type { DocumentSummary } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const dbError = await ensureDatabaseForApi();
  if (dbError) return dbError;

  const { id } = await params;
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const summary: DocumentSummary = {
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

  return NextResponse.json(summary);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const dbError = await ensureDatabaseForApi();
  if (dbError) return dbError;

  const { id } = await params;
  await db.delete(documents).where(eq(documents.id, id));
  return NextResponse.json({ ok: true });
}
