import { desc } from "drizzle-orm";
import { LibraryPageClient } from "@/components/library/LibraryPageClient";
import { SetupRequired } from "@/components/setup/SetupRequired";
import { db, prepareDatabase } from "@/lib/db/prepare";
import { documents } from "@/lib/db/schema";
import type { DocumentSummary } from "@/types";

export const dynamic = "force-dynamic";

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

export default async function HomePage() {
  try {
    await prepareDatabase();
    const rows = await db
      .select()
      .from(documents)
      .orderBy(desc(documents.createdAt));

    return <LibraryPageClient initialDocuments={rows.map(toSummary)} />;
  } catch (error) {
    console.error("[HomePage] database error:", error);
    return <SetupRequired error={error} />;
  }
}
