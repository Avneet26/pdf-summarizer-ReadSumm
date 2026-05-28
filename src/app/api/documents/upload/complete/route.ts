import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";

import { isBlobConfigured } from "@/lib/blob/config";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { sanitizeErrorMessage } from "@/lib/utils/sanitize-error-message";

export const runtime = "nodejs";
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
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Unknown document." }, { status: 404 });
    }

    after(async () => {
      try {
        await db
          .update(documents)
          .set({ uploadObjectPath: blobUrl })
          .where(eq(documents.id, documentId));

        // Worker must load before pdf-parse (DOMMatrix polyfill on Vercel).
        await import("pdf-parse/worker");
        const { runStagedUploadProcessing } =
          await import("@/lib/processing/run-staged-upload");
        await runStagedUploadProcessing(documentId);
      } catch (error) {
        const raw =
          error instanceof Error ? error.message : "Processing failed to start.";
        console.error(`[PDF] after() processing error: ${raw}`);
        await db
          .update(documents)
          .set({
            status: "failed",
            errorMessage: sanitizeErrorMessage(raw),
            uploadObjectPath: null,
          })
          .where(eq(documents.id, documentId));
      }
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
