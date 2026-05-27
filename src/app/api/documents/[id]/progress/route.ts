import { NextResponse } from "next/server";
import { ensureDatabaseForApi } from "@/lib/db/api-prepare";
import {
  getReadingProgress,
  saveReadingProgress,
} from "@/lib/db/reading-progress";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const dbError = await ensureDatabaseForApi();
  if (dbError) return dbError;

  const { id } = await params;
  const progress = await getReadingProgress(id);

  return NextResponse.json(
    progress ?? { lastCardIndex: 0, lastCardId: null, updatedAt: null },
  );
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const dbError = await ensureDatabaseForApi();
  if (dbError) return dbError;

  const { id } = await params;
  const body = (await request.json()) as {
    lastCardIndex?: number;
    lastCardId?: string | null;
  };

  if (
    typeof body.lastCardIndex !== "number" ||
    !Number.isInteger(body.lastCardIndex) ||
    body.lastCardIndex < 0
  ) {
    return NextResponse.json(
      { error: "lastCardIndex must be a non-negative integer" },
      { status: 400 },
    );
  }

  const progress = await saveReadingProgress(
    id,
    body.lastCardIndex,
    body.lastCardId ?? null,
  );

  return NextResponse.json(progress);
}
