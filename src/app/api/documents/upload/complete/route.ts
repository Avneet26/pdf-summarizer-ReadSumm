import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";

import { MAX_UPLOAD_BYTES, formatMaxUploadLimit } from "@/lib/constants";
import { deleteStagedBlob, downloadStagedBlob } from "@/lib/blob/staged";
import { isBlobConfigured } from "@/lib/blob/config";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { bufferHasPdfHeader } from "@/lib/utils/pdf-file";

export const runtime = "nodejs";
/** Hobby (non–fluid compute) allows at most 60s; keep within that limit. */
export const maxDuration = 60;

interface CompleteRequestBody {
  documentId?: unknown;
  blobUrl?: unknown;
}

export async function POST(request: Request) {
  try {
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
    const blobUrl =
      typeof payload.blobUrl === "string" ? payload.blobUrl.trim() : "";

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

    const originalFilename = doc.originalFilename;

    after(async () => {
      let buffer: Buffer;
      try {
        buffer = await downloadStagedBlob(blobUrl);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not read the uploaded file.";
        console.error(`[PDF] Download from Blob failed: ${message}`);
        await db
          .update(documents)
          .set({
            status: "failed",
            errorMessage: "Could not read the uploaded file. Please try again.",
            uploadObjectPath: null,
          })
          .where(eq(documents.id, documentId));
        return;
      }

      if (buffer.byteLength > MAX_UPLOAD_BYTES) {
        void deleteStagedBlob(blobUrl);
        await db
          .update(documents)
          .set({
            uploadObjectPath: null,
            status: "failed",
            errorMessage: `File exceeds the ${formatMaxUploadLimit()} upload limit.`,
          })
          .where(eq(documents.id, documentId));
        return;
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
        return;
      }

      await db
        .update(documents)
        .set({ uploadObjectPath: blobUrl })
        .where(eq(documents.id, documentId));

      console.log(
        `[PDF] Upload complete: ${documentId} (${(buffer.byteLength / 1024).toFixed(1)} KB)`,
      );

      const { processDocument } = await import("@/lib/processing/process-document");

      await processDocument(documentId, buffer, originalFilename, {
        onFinished: async () => {
          await deleteStagedBlob(blobUrl);
          await db
            .update(documents)
            .set({ uploadObjectPath: null })
            .where(eq(documents.id, documentId));
          console.log(`[PDF] Cleaned up staged blob for ${documentId}`);
        },
      });
    });

    return NextResponse.json(
      {
        id: documentId,
        status: "queued",
        message: "Upload received. Processing started.",
      },
      { status: 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload finalization failed.";
    console.error(`[PDF] Complete route error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
