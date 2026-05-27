import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ReaderPageClient } from "@/components/reader/ReaderPageClient";
import { db } from "@/lib/db";
import {
  getReadingProgress,
  resolveCardIndex,
} from "@/lib/db/reading-progress";
import { cards, chunks, documents } from "@/lib/db/schema";
import type { CardItem, DocumentSummary } from "@/types";

export const dynamic = "force-dynamic";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  if (!doc) notFound();

  const cardRows = await db
    .select({
      id: cards.id,
      orderIndex: cards.orderIndex,
      subtitle: cards.subtitle,
      body: cards.body,
      wordCount: cards.wordCount,
      sourcePages: chunks.sourcePages,
    })
    .from(cards)
    .innerJoin(chunks, eq(cards.chunkId, chunks.id))
    .where(eq(cards.documentId, id))
    .orderBy(asc(cards.orderIndex));

  const initialDocument: DocumentSummary = {
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

  const initialCards: CardItem[] = cardRows.map((row) => ({
    id: row.id,
    orderIndex: row.orderIndex,
    subtitle: row.subtitle,
    body: row.body,
    wordCount: row.wordCount,
    sourcePages: row.sourcePages,
  }));

  const progress = await getReadingProgress(id);
  const initialCardIndex = resolveCardIndex(initialCards, progress);

  return (
    <ReaderPageClient
      documentId={id}
      initialDocument={initialDocument}
      initialCards={initialCards}
      initialCardIndex={initialCardIndex}
    />
  );
}
