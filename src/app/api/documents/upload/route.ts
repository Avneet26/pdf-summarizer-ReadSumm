import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import {
  MAX_UPLOAD_BYTES,
  formatMaxUploadLimit,
} from "@/lib/constants";
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

// Best-effort detection of "client went away mid-upload" errors. On mobile
// these surface from request.formData() / arrayBuffer() when the multipart
// stream is cut. They should not be reported as 500s.
function isClientDisconnectError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  return (
    name === "aborterror" ||
    message.includes("aborted") ||
    message.includes("unexpected end") ||
    message.includes("premature close") ||
    message.includes("connection") ||
    message.includes("malformed") ||
    message.includes("multipart")
  );
}

export async function POST(request: Request) {
  // Reject early when the client advertises a body larger than we accept.
  // Vercel's edge would otherwise return a generic 413 HTML page that the
  // client cannot parse as JSON.
  const contentLength = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds the ${formatMaxUploadLimit()} upload limit. Try a smaller PDF.`,
      },
      { status: 413 },
    );
  }

  let file: File;
  let buffer: Buffer;
  try {
    const formData = await request.formData();
    const value = formData.get("file");

    if (!(value instanceof File)) {
      return NextResponse.json({ error: "No PDF file provided." }, { status: 400 });
    }
    file = value;

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `File exceeds the ${formatMaxUploadLimit()} upload limit. Try a smaller PDF.`,
        },
        { status: 413 },
      );
    }

    buffer = Buffer.from(await file.arrayBuffer());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read upload.";
    if (isClientDisconnectError(error)) {
      console.warn(`[PDF] Upload interrupted by client: ${message}`);
      return NextResponse.json(
        {
          error:
            "Upload was interrupted before it finished. Check your connection and try again.",
        },
        { status: 400 },
      );
    }
    console.error(`[PDF] Upload parse failed: ${message}`);
    return NextResponse.json(
      { error: "Could not read the uploaded file. Please try again." },
      { status: 400 },
    );
  }

  try {
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
