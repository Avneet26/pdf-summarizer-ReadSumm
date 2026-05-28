import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { MAX_UPLOAD_BYTES, formatMaxUploadLimit } from "@/lib/constants";
import { deleteStagedBlob, downloadStagedBlob } from "@/lib/blob/staged";
import { isBlobConfigured } from "@/lib/blob/config";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { processDocument } from "@/lib/processing/process-document";
import { bufferHasPdfHeader } from "@/lib/utils/pdf-file";

export const runtime = "nodejs";
export const maxDuration = 300;

interface CompleteRequestBody {
  documentId?: unknown;
  blobUrl?: unknown;
}

export async function POST(request: Request) {
  const dbError = await ensureDatabaseForApi();
  if (dbError) return dbError;

  if (!isBlobConfigured()) {
    return NextResponse.json(
      {
        error:
          "Upload storage is not configured. Add a Vercel Blob store to the project.",
      },
      { status: 503 },
    );
  }

  let payload: CompleteRequestBody;
  try {
    payload = (await request.json()) as CompleteRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const documentId =
    typeof payload.documentId === "string" ? payload.documentId.trim() : "";
  const blobUrl = typeof payload.blobUrl === "string" ? payload.blobUrl.trim() : "";

  if (!documentId || !blobUrl) {
    return NextResponse.json(
      { error: "Missing documentId or blobUrl." },
      { status: 400 },
    );
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Unknown document." }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await downloadStagedBlob(blobUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read the uploaded file.";
    console.error(`[PDF] Download from Blob failed: ${message}`);
    return NextResponse.json(
      { error: "Could not read the uploaded file. Please try again." },
      { status: 502 },
    );
  }

  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    void deleteStagedBlob(blobUrl);
    await db
      .update(documents)
      .set({ uploadObjectPath: null })
      .where(eq(documents.id, documentId));
    return NextResponse.json(
      {
        error: `File exceeds the ${formatMaxUploadLimit()} upload limit. Try a smaller PDF.`,
      },
      { status: 413 },
    );
  }

  if (!bufferHasPdfHeader(buffer)) {
    void deleteStagedBlob(blobUrl);
    await db
      .update(documents)
      .set({
        uploadObjectPath: null,
        status: "failed",
        errorMessage: "The uploaded file is not a PDF.",
      })
      .where(eq(documents.id, documentId));
    return NextResponse.json(
      { error: "Only PDF files are supported." },
      { status: 400 },
    );
  }

  await db
    .update(documents)
    .set({ uploadObjectPath: blobUrl })
    .where(eq(documents.id, documentId));

  console.log(
    `[PDF] Upload complete: ${documentId} (${(buffer.byteLength / 1024).toFixed(1)} KB)`,
  );

  void processDocument(documentId, buffer, doc.originalFilename, {
    onFinished: async () => {
      await deleteStagedBlob(blobUrl);
      await db
        .update(documents)
        .set({ uploadObjectPath: null })
        .where(eq(documents.id, documentId));
      console.log(`[PDF] Cleaned up staged blob for ${documentId}`);
    },
  });

  return NextResponse.json(
    {
      id: documentId,
      status: "queued",
      message: "Upload received. Processing started.",
    },
    { status: 202 },
  );
}
