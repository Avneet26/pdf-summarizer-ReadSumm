import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { MAX_UPLOAD_BYTES, formatMaxUploadLimit } from "@/lib/constants";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { isFirebaseConfigured } from "@/lib/firebase/admin";
import { deleteUpload, downloadUpload } from "@/lib/firebase/uploads";
import { processDocument } from "@/lib/processing/process-document";
import { bufferHasPdfHeader } from "@/lib/utils/pdf-file";

export const runtime = "nodejs";
export const maxDuration = 300;

interface CompleteRequestBody {
  documentId?: unknown;
}

export async function POST(request: Request) {
  if (!isFirebaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "File storage is not configured on the server. Set the FIREBASE_* environment variables.",
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
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Unknown document." }, { status: 404 });
  }

  if (!doc.uploadObjectPath) {
    return NextResponse.json(
      { error: "This upload has no staged file. Re-upload to try again." },
      { status: 409 },
    );
  }

  const objectPath = doc.uploadObjectPath;

  let buffer: Buffer;
  try {
    buffer = await downloadUpload(objectPath);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read the uploaded file.";
    console.error(`[PDF] Download from Firebase failed: ${message}`);
    return NextResponse.json(
      { error: "Could not read the uploaded file. Please try again." },
      { status: 502 },
    );
  }

  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    void deleteUpload(objectPath);
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
    void deleteUpload(objectPath);
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

  console.log(
    `[PDF] Upload complete: ${documentId} (${(buffer.byteLength / 1024).toFixed(1)} KB)`,
  );

  // Kick off processing in the background. The processor will delete the
  // staged Firebase object once it has finished (success or failure) via
  // the cleanup callback.
  void processDocument(documentId, buffer, doc.originalFilename, {
    onFinished: async () => {
      await deleteUpload(objectPath);
      await db
        .update(documents)
        .set({ uploadObjectPath: null })
        .where(eq(documents.id, documentId));
      console.log(`[PDF] Cleaned up staged upload for ${documentId}`);
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
