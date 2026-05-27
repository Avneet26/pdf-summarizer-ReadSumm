"use client";

import { useRef, useState } from "react";
import { MAX_UPLOAD_BYTES, formatMaxUploadLimit } from "@/lib/constants";
import { isAcceptedPdfFile } from "@/lib/utils/pdf-file";
import { cn } from "@/lib/utils/cn";

interface UploadDropzoneProps {
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  /** Upload progress in [0, 1]. Optional. */
  progress?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function UploadDropzone({
  onUpload,
  uploading,
  progress,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!(await isAcceptedPdfFile(file))) {
      setError("Please upload a PDF file.");
      return;
    }
    // Pre-flight size check so mobile users get a clear error instead of a
    // confusing 413 / network failure from the platform's edge.
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `That PDF is ${formatFileSize(file.size)}, but the upload limit is ${formatMaxUploadLimit()}. Try a smaller file.`,
      );
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
        accept="application/pdf"
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
      <p className="mt-1 text-xs text-muted">
        PDFs up to {formatMaxUploadLimit()}.
      </p>

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="mt-6 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {uploading
          ? progress !== undefined && progress > 0 && progress < 1
            ? `Uploading ${Math.round(progress * 100)}%`
            : "Processing upload…"
          : "Choose PDF"}
      </button>

      {uploading && progress !== undefined ? (
        <div
          className="mx-auto mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-black/10"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-foreground transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
