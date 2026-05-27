import { NextResponse } from "next/server";
import { DatabaseConfigError } from "./env";
import { prepareDatabase } from "./prepare";

/** Returns an error response when the database is unavailable; otherwise null. */
export async function ensureDatabaseForApi(): Promise<NextResponse | null> {
  try {
    await prepareDatabase();
    return null;
  } catch (error) {
    console.error("[api] database error:", error);
    const status = error instanceof DatabaseConfigError ? 503 : 500;
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status });
  }
}
