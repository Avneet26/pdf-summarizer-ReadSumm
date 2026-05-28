import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";

import { MAX_UPLOAD_BYTES, formatMaxUploadLimit } from "@/lib/constants";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { accentColorFromTitle } from "@/lib/utils/accent-color";
import {
  bufferHasPdfHeader,
  hasPdfExtension,
  hasPdfMimeType,
} from "@/lib/utils/pdf-file";
import { sanitizeErrorMessage } from "@/lib/utils/sanitize-error-message";

export const runtime = "nodejs";
/** Hobby (non–fluid compute) allows at most 60s; keep within that limit. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const dbError = await ensureDatabaseForApi();
  if (dbError) return dbError;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No PDF file provided." }, { status: 400 });
  }

  const filename = file.name?.trim() || "document.pdf";
  const contentType = file.type?.trim() || "application/pdf";

  if (!hasPdfExtension(filename) && !hasPdfMimeType(contentType)) {
    return NextResponse.json(
      { error: "Only PDF files are supported." },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds the ${formatMaxUploadLimit()} upload limit. Try a smaller PDF.`,
      },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!bufferHasPdfHeader(buffer)) {
    return NextResponse.json(
      { error: "Only PDF files are supported." },
      { status: 400 },
    );
  }

  const documentId = nanoid();
  const titleGuess = filename.replace(/\.pdf$/i, "").replace(/[_-]/g, " ").trim();
  const createdAt = new Date().toISOString();

  await db.insert(documents).values({
    id: documentId,
    title: titleGuess || "Untitled Document",
    originalFilename: filename,
    status: "queued",
    accentColor: accentColorFromTitle(titleGuess || filename),
    createdAt,
    uploadObjectPath: null,
  });

  console.log(
    `[PDF] Direct upload received: "${filename}" (${(buffer.byteLength / 1024).toFixed(1)} KB) → ${documentId}`,
  );

  after(async () => {
    try {
      const { processDocument } = await import("@/lib/processing/process-document");
      await processDocument(documentId, buffer, filename);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Processing failed.";
      console.error(`[PDF] Direct upload processing error: ${raw}`);
      await db
        .update(documents)
        .set({ status: "failed", errorMessage: sanitizeErrorMessage(raw) })
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
}
