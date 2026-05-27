"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { DocumentSummary } from "@/types";

interface DocTileProps {
  document: DocumentSummary;
  index: number;
  onDelete: (id: string) => void;
}

export function DocTile({ document, index, onDelete }: DocTileProps) {
  const isProcessing = ["queued", "extracting", "chunking", "summarizing"].includes(
    document.status,
  );
  const hasReadingProgress =
    document.status === "ready" &&
    (document.lastCardIndex ?? 0) > 0 &&
    document.totalCards > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
      className="group relative overflow-hidden rounded-3xl border border-black/5 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ backgroundColor: document.accentColor }}
      />

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl leading-tight text-foreground">
            {document.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{document.originalFilename}</p>
        </div>
        <Badge status={document.status} />
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Pages</dt>
          <dd className="font-medium">{document.pageCount || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Cards</dt>
          <dd className="font-medium">
            {isProcessing
              ? `${document.processedCards} / ${document.totalCards || "…"}`
              : document.totalCards}
          </dd>
        </div>
      </dl>

      {hasReadingProgress ? (
        <p className="mb-4 text-sm text-muted">
          Left off at card {Math.min((document.lastCardIndex ?? 0) + 1, document.totalCards)}{" "}
          of {document.totalCards}
        </p>
      ) : null}

      {document.status === "failed" && document.errorMessage ? (
        <p className="mb-4 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {document.errorMessage}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        {document.status === "ready" ? (
          <Link
            href={`/documents/${document.id}`}
            className="inline-flex flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: document.accentColor }}
          >
            {hasReadingProgress ? "Continue reading" : "Read cards"}
          </Link>
        ) : (
          <span className="inline-flex flex-1 items-center justify-center rounded-full bg-black/5 px-4 py-2 text-sm text-muted">
            {isProcessing ? "Processing…" : "Unavailable"}
          </span>
        )}
        <Button
          variant="ghost"
          className="rounded-full px-3 py-2 text-muted hover:text-red-600"
          onClick={() => onDelete(document.id)}
          aria-label={`Delete ${document.title}`}
        >
          Delete
        </Button>
      </div>
    </motion.article>
  );
}
