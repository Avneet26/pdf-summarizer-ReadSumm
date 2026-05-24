"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface UploadDropzoneProps {
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
}

export function UploadDropzone({ onUpload, uploading }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    try {
      await onUpload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <div
      className={cn(
        "rounded-[2rem] border-2 border-dashed px-6 py-10 text-center transition",
        dragging
          ? "border-indigo-400 bg-indigo-50/80"
          : "border-black/10 bg-white/80 hover:border-black/20",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) await handleFile(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) await handleFile(file);
          event.target.value = "";
        }}
      />

      <p className="font-display text-2xl text-foreground">
        {uploading ? "Uploading PDF…" : "Drop a PDF here"}
      </p>
      <p className="mt-2 text-sm text-muted">
        Books, papers, reports — we&apos;ll create easy-read cards chapter by chapter
        or page by page.
      </p>

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="mt-6 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {uploading ? "Processing upload…" : "Choose PDF"}
      </button>

      {error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
