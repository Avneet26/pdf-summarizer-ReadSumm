"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CardDeck } from "@/components/reader/CardDeck";
import { Badge } from "@/components/ui/Badge";
import type { CardItem, DocumentSummary } from "@/types";

interface ReaderPageClientProps {
  documentId: string;
  initialDocument: DocumentSummary;
  initialCards: CardItem[];
}

export function ReaderPageClient({
  documentId,
  initialDocument,
  initialCards,
}: ReaderPageClientProps) {
  const [document, setDocument] = useState(initialDocument);
  const [cards, setCards] = useState(initialCards);

  const fetchData = useCallback(async () => {
    const [docRes, cardsRes] = await Promise.all([
      fetch(`/api/documents/${documentId}`),
      fetch(`/api/documents/${documentId}/cards`),
    ]);

    if (docRes.ok) {
      setDocument((await docRes.json()) as DocumentSummary);
    }

    if (cardsRes.ok) {
      setCards((await cardsRes.json()) as CardItem[]);
    }
  }, [documentId]);

  useEffect(() => {
    const isProcessing = ["queued", "extracting", "chunking", "summarizing"].includes(
      document.status,
    );
    if (!isProcessing) return;

    const interval = setInterval(() => {
      void fetchData();
    }, 3000);

    return () => clearInterval(interval);
  }, [document.status, fetchData]);

  const isProcessing = ["queued", "extracting", "chunking", "summarizing"].includes(
    document.status,
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10 md:py-14">
      <header className="space-y-4">
        <Link href="/" className="text-sm text-muted transition hover:text-foreground">
          ← Back to library
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl text-foreground md:text-4xl">
            {document.title}
          </h1>
          <Badge status={document.status} />
        </div>
        <p className="text-sm text-muted">
          {document.pageCount} pages
          {document.chunkStrategy ? ` · ${document.chunkStrategy} split` : ""}
        </p>
      </header>

      {document.status === "failed" ? (
        <div className="rounded-[2rem] bg-red-50 px-6 py-5 text-red-700">
          {document.errorMessage ?? "Processing failed."}
        </div>
      ) : null}

      {isProcessing ? (
        <div className="space-y-4 rounded-[2rem] border border-black/5 bg-white p-8">
          <p className="font-display text-2xl">Creating your easy-read cards…</p>
          <p className="text-muted">
            {document.processedCards} of {document.totalCards || "…"} cards ready
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width:
                  document.totalCards > 0
                    ? `${(document.processedCards / document.totalCards) * 100}%`
                    : "12%",
                backgroundColor: document.accentColor,
              }}
            />
          </div>
          {cards.length > 0 ? (
            <CardDeck cards={cards} accentColor={document.accentColor} />
          ) : (
            <div className="h-[420px] animate-pulse rounded-[2rem] bg-black/5" />
          )}
        </div>
      ) : (
        <CardDeck cards={cards} accentColor={document.accentColor} />
      )}
    </div>
  );
}
