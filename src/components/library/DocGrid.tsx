"use client";

import { motion } from "framer-motion";
import { DocTile } from "@/components/library/DocTile";
import { Skeleton } from "@/components/ui/Skeleton";
import type { DocumentSummary } from "@/types";

interface DocGridProps {
  documents: DocumentSummary[];
  loading: boolean;
  onDelete: (id: string) => void;
}

export function DocGrid({ documents, loading, onDelete }: DocGridProps) {
  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-[2rem] border border-dashed border-black/10 bg-white/70 px-8 py-16 text-center"
      >
        <p className="font-display text-2xl text-foreground">Your library is empty</p>
        <p className="mx-auto mt-3 max-w-md text-muted">
          Upload a PDF book or research paper. We&apos;ll turn it into easy-to-read
          summary cards you can swipe through.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((document, index) => (
        <DocTile
          key={document.id}
          document={document}
          index={index}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
