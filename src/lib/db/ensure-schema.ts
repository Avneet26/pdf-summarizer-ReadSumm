import path from "node:path";
import { migrate } from "drizzle-orm/libsql/migrator";
import { assertDatabaseConfigured } from "./env";
import { db } from "./index";

let ready: Promise<void> | null = null;

/** Applies committed SQL migrations so tables exist (safe to call repeatedly). */
export function ensureDatabaseReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      assertDatabaseConfigured();
      await migrate(db, {
        migrationsFolder: path.join(process.cwd(), "drizzle/migrations"),
      });
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
