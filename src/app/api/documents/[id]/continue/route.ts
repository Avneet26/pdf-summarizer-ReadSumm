import { NextResponse } from "next/server";

import { continueDocumentProcessing } from "@/lib/processing/process-document";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import { authorizeContinueRequest } from "@/lib/server/continue-trigger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!authorizeContinueRequest(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const dbError = await ensureDatabaseForApi();
  if (dbError) return dbError;

  const { id: documentId } = await params;

  try {
    const result = await continueDocumentProcessing(documentId);

    return NextResponse.json(
      {
        id: documentId,
        done: result.done,
        processedCards: result.processedCards,
        totalCards: result.totalCards,
      },
      { status: result.done ? 200 : 202 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed.";
    console.error(`[PDF] Continue route error (${documentId}): ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
