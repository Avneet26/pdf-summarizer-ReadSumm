export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureDatabaseReady } = await import("@/lib/db/ensure-schema");
  await ensureDatabaseReady();
}
