import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { processDocument } from "@/lib/processing/process-document";
import { accentColorFromTitle } from "@/lib/utils/accent-color";
import {
  bufferHasPdfHeader,
  isLikelyPdfByMetadata,
} from "@/lib/utils/pdf-file";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No PDF file provided." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 50MB upload limit." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!isLikelyPdfByMetadata(file.name, file.type) && !bufferHasPdfHeader(buffer)) {
      return NextResponse.json(
        { error: "Only PDF files are supported." },
        { status: 400 },
      );
    }
    const titleGuess = file.name.replace(/\.pdf$/i, "").replace(/[_-]/g, " ").trim();
    const documentId = nanoid();
    const createdAt = new Date().toISOString();

    await db.insert(documents).values({
      id: documentId,
      title: titleGuess || "Untitled Document",
      originalFilename: file.name,
      status: "queued",
      accentColor: accentColorFromTitle(titleGuess || file.name),
      createdAt,
    });

    console.log(
      `[PDF] Upload received: "${file.name}" (${(file.size / 1024).toFixed(1)} KB) → ${documentId}`,
    );

    void processDocument(documentId, buffer, file.name);

    return NextResponse.json(
      {
        id: documentId,
        status: "queued",
        message: "Upload received. Processing started.",
      },
      { status: 202 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed unexpectedly.";
    console.error(`[PDF] Upload failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
