import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { documentIdFromPathname } from "@/lib/blob/paths";
import { isBlobConfigured } from "@/lib/blob/config";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const dbError = await ensureDatabaseForApi();
  if (dbError) return dbError;

  if (!isBlobConfigured()) {
    return NextResponse.json(
      { error: "Vercel Blob is not configured." },
      { status: 503 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let documentId: string | null = null;
        if (clientPayload) {
          try {
            const parsed = JSON.parse(clientPayload) as { documentId?: string };
            documentId = parsed.documentId ?? null;
          } catch {
            documentId = null;
          }
        }

        if (!documentId) {
          documentId = documentIdFromPathname(pathname);
        }

        if (!documentId) {
          throw new Error("Invalid upload session.");
        }

        const [doc] = await db
          .select({ id: documents.id, uploadObjectPath: documents.uploadObjectPath })
          .from(documents)
          .where(eq(documents.id, documentId))
          .limit(1);

        if (!doc || doc.uploadObjectPath !== pathname) {
          throw new Error("Upload session expired or invalid. Please try again.");
        }

        return {
          allowedContentTypes: [
            "application/pdf",
            "application/x-pdf",
            "application/vnd.pdf",
            "application/octet-stream",
          ],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          tokenPayload: JSON.stringify({ documentId }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload token failed.";
    console.error(`[PDF] Blob client upload error: ${message}`);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
