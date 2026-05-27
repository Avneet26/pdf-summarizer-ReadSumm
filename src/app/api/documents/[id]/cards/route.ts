import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import { db } from "@/lib/db";
import { cards, chunks } from "@/lib/db/schema";
import type { CardItem } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const dbError = await ensureDatabaseForApi();
  if (dbError) return dbError;

  const { id } = await params;

  const rows = await db
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

  const items: CardItem[] = rows.map((row) => ({
    id: row.id,
    orderIndex: row.orderIndex,
    subtitle: row.subtitle,
    body: row.body,
    wordCount: row.wordCount,
    sourcePages: row.sourcePages,
  }));

  return NextResponse.json(items);
}
