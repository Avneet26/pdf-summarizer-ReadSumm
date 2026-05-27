import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { readingProgress } from "@/lib/db/schema";
import { SINGLE_USER_ID } from "@/lib/constants";
import type { CardItem, ReadingProgress } from "@/types";

export async function getReadingProgress(
  documentId: string,
): Promise<ReadingProgress | null> {
  const [row] = await db
    .select()
    .from(readingProgress)
    .where(
      and(
        eq(readingProgress.documentId, documentId),
        eq(readingProgress.userId, SINGLE_USER_ID),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    lastCardIndex: row.lastCardIndex,
    lastCardId: row.lastCardId,
    updatedAt: row.updatedAt,
  };
}

export async function saveReadingProgress(
  documentId: string,
  lastCardIndex: number,
  lastCardId: string | null,
): Promise<ReadingProgress> {
  const updatedAt = new Date().toISOString();

  await db
    .insert(readingProgress)
    .values({
      userId: SINGLE_USER_ID,
      documentId,
      lastCardIndex,
      lastCardId,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: [readingProgress.userId, readingProgress.documentId],
      set: { lastCardIndex, lastCardId, updatedAt },
    });

  return { lastCardIndex, lastCardId, updatedAt };
}

export function resolveCardIndex(
  cards: CardItem[],
  progress: ReadingProgress | null,
): number {
  if (!progress || cards.length === 0) return 0;

  if (progress.lastCardId) {
    const byId = cards.findIndex((card) => card.id === progress.lastCardId);
    if (byId >= 0) return byId;
  }

  if (
    progress.lastCardIndex >= 0 &&
    progress.lastCardIndex < cards.length
  ) {
    return progress.lastCardIndex;
  }

  return 0;
}
