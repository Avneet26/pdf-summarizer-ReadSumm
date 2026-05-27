import { NextResponse } from "next/server";

import { MAX_UPLOAD_BYTES, formatMaxUploadLimit } from "@/lib/constants";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { isFirebaseConfigured } from "@/lib/firebase/admin";
import {
  buildObjectPath,
  createSignedUploadUrl,
  newDocumentId,
} from "@/lib/firebase/uploads";
import { accentColorFromTitle } from "@/lib/utils/accent-color";
import { hasPdfExtension, hasPdfMimeType } from "@/lib/utils/pdf-file";

export const runtime = "nodejs";

interface SignRequestBody {
  filename?: unknown;
  contentType?: unknown;
  size?: unknown;
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

  let payload: SignRequestBody;
  try {
    payload = (await request.json()) as SignRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const filename =
    typeof payload.filename === "string" ? payload.filename.trim() : "";
  const contentType =
    typeof payload.contentType === "string" && payload.contentType.trim()
      ? payload.contentType.trim()
      : "application/pdf";
  const size = typeof payload.size === "number" ? payload.size : NaN;

  if (!filename) {
    return NextResponse.json({ error: "Missing filename." }, { status: 400 });
  }

  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "Missing or invalid file size." }, { status: 400 });
  }

  if (size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `File exceeds the ${formatMaxUploadLimit()} upload limit. Try a smaller PDF.`,
      },
      { status: 413 },
    );
  }

  if (!hasPdfExtension(filename) && !hasPdfMimeType(contentType)) {
    return NextResponse.json(
      { error: "Only PDF files are supported." },
      { status: 400 },
    );
  }

  const documentId = newDocumentId();
  const objectPath = buildObjectPath(documentId, filename);
  const titleGuess = filename.replace(/\.pdf$/i, "").replace(/[_-]/g, " ").trim();

  let signed;
  try {
    signed = await createSignedUploadUrl(objectPath, contentType);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not create upload URL.";
    console.error(`[PDF] Sign upload failed: ${message}`);
    return NextResponse.json(
      { error: "Could not prepare the upload. Please try again." },
      { status: 500 },
    );
  }

  await db.insert(documents).values({
    id: documentId,
    title: titleGuess || "Untitled Document",
    originalFilename: filename,
    status: "queued",
    accentColor: accentColorFromTitle(titleGuess || filename),
    createdAt: new Date().toISOString(),
    uploadObjectPath: objectPath,
  });

  console.log(
    `[PDF] Signed upload URL issued for "${filename}" → ${documentId} (${objectPath})`,
  );

  return NextResponse.json({
    documentId,
    objectPath,
    uploadUrl: signed.uploadUrl,
    contentType,
    expiresAt: signed.expiresAt,
  });
}
