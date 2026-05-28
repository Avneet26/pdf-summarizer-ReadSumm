import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";

import { isStorageConfigured } from "@/lib/storage/config";
import { stagedFileExists } from "@/lib/storage/staged";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { sanitizeErrorMessage } from "@/lib/utils/sanitize-error-message";

export const runtime = "nodejs";
export const maxDuration = 60;

interface CompleteRequestBody {
  documentId?: unknown;
}

export async function POST(request: Request) {
  try {
    const dbError = await ensureDatabaseForApi();
    if (dbError) return dbError;

    if (!isStorageConfigured()) {
      return NextResponse.json(
        {
          error:
            "Upload storage is not configured. Set Cloudflare R2 credentials in the environment.",
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

    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId." }, { status: 400 });
    }

    const [doc] = await db
      .select({
        id: documents.id,
        uploadObjectPath: documents.uploadObjectPath,
      })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "Unknown document." }, { status: 404 });
    }

    const objectPath = doc.uploadObjectPath?.trim();
    if (!objectPath) {
      return NextResponse.json(
        { error: "No staged upload found for this document." },
        { status: 400 },
      );
    }

    const exists = await stagedFileExists(objectPath);
    if (!exists) {
      return NextResponse.json(
        { error: "Uploaded file was not found in storage. Please try again." },
        { status: 400 },
      );
    }

    after(async () => {
      try {
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
