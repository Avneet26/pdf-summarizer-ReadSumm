import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { MAX_UPLOAD_BYTES, formatMaxUploadLimit } from "@/lib/constants";
import { buildUploadPathname } from "@/lib/blob/paths";
import { isBlobConfigured } from "@/lib/blob/config";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { accentColorFromTitle } from "@/lib/utils/accent-color";
import { hasPdfExtension, hasPdfMimeType } from "@/lib/utils/pdf-file";

export const runtime = "nodejs";

interface PrepareRequestBody {
  filename?: unknown;
  contentType?: unknown;
  size?: unknown;
}

export async function POST(request: Request) {
  const dbError = await ensureDatabaseForApi();
  if (dbError) return dbError;

  if (!isBlobConfigured()) {
    return NextResponse.json(
      {
        error:
          "Upload storage is not configured. Add a Vercel Blob store to the project (BLOB_READ_WRITE_TOKEN).",
      },
      { status: 503 },
    );
  }

  let payload: PrepareRequestBody;
  try {
    payload = (await request.json()) as PrepareRequestBody;
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

  const looksLikePdf =
    hasPdfExtension(filename) ||
    hasPdfMimeType(contentType) ||
    contentType === "application/octet-stream";
  if (!looksLikePdf) {
    return NextResponse.json(
      { error: "Only PDF files are supported." },
      { status: 400 },
    );
  }

  const documentId = nanoid();
  const pathname = buildUploadPathname(documentId, filename);
  const titleGuess = filename.replace(/\.pdf$/i, "").replace(/[_-]/g, " ").trim();

  await db.insert(documents).values({
    id: documentId,
    title: titleGuess || "Untitled Document",
    originalFilename: filename,
    status: "queued",
    accentColor: accentColorFromTitle(titleGuess || filename),
    createdAt: new Date().toISOString(),
    uploadObjectPath: pathname,
  });

  console.log(
    `[PDF] Upload prepared: "${filename}" → ${documentId} (${pathname})`,
  );

  return NextResponse.json({ documentId, pathname });
}
