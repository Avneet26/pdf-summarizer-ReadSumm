import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { runStagedUploadProcessing } from "@/lib/processing/run-staged-upload";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { authorizeProcessTrigger } from "@/lib/server/process-trigger";

export const runtime = "nodejs";
/** Hobby (non–fluid compute) allows at most 60s; keep within that limit. */
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!authorizeProcessTrigger(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const dbError = await ensureDatabaseForApi();
  if (dbError) return dbError;

  const { id: documentId } = await params;

  const [doc] = await db
    .select({ id: documents.id, status: documents.status })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Unknown document." }, { status: 404 });
  }

  try {
    await runStagedUploadProcessing(documentId);

    const [updated] = await db
      .select({ status: documents.status, errorMessage: documents.errorMessage })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (updated?.status === "failed") {
      return NextResponse.json(
        { error: updated.errorMessage ?? "Processing failed." },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: documentId, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed.";
    console.error(`[PDF] Process route error (${documentId}): ${message}`);

    await db
      .update(documents)
      .set({
        status: "failed",
        errorMessage: message,
        uploadObjectPath: null,
      })
      .where(eq(documents.id, documentId));

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
