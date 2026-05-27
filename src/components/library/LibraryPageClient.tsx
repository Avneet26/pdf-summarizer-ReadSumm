"use client";

import { useCallback, useEffect, useState } from "react";
import { DocGrid } from "@/components/library/DocGrid";
import { UploadDropzone } from "@/components/library/UploadDropzone";
import { parseJsonResponse } from "@/lib/utils/parse-json-response";
import type { DocumentSummary } from "@/types";

interface LibraryPageClientProps {
  initialDocuments: DocumentSummary[];
}

export function LibraryPageClient({ initialDocuments }: LibraryPageClientProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    const response = await fetch("/api/documents");
    if (!response.ok) return;
    const data = await parseJsonResponse<DocumentSummary[]>(response);
    setDocuments(data);
  }, []);

  useEffect(() => {
    const hasProcessing = documents.some((doc) =>
      ["queued", "extracting", "chunking", "summarizing"].includes(doc.status),
    );
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      void fetchDocuments();
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  async function handleUpload(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    });

    const payload = await parseJsonResponse<{ error?: string }>(response);
    if (!response.ok) {
      setUploading(false);
      throw new Error(payload.error ?? `Upload failed (${response.status}).`);
    }

    await fetchDocuments();
    setUploading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document and all its cards?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10 md:py-14">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">
            PDF Easy Read
          </p>
          <h1 className="font-display mt-2 text-4xl text-foreground md:text-5xl">
            Your reading library
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            Upload long PDFs and read them as colorful, easy-to-digest cards —
            chapter by chapter or page by page.
          </p>
        </div>
      </header>

      <UploadDropzone onUpload={handleUpload} uploading={uploading} />
      <DocGrid documents={documents} loading={false} onDelete={handleDelete} />
    </div>
  );
}
