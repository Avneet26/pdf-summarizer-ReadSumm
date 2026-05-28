import { assertDatabaseConfigured } from "./env";
import { client } from "./index";
import { bootstrapSchema } from "./bootstrap-schema";

let ready: Promise<void> | null = null;

/** Validates env (on Vercel) and ensures tables exist before queries. */
export function prepareDatabase(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      assertDatabaseConfigured();
      await bootstrapSchema(client);
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
