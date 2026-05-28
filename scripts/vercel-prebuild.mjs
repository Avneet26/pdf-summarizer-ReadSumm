import { execSync } from "node:child_process";

const url = process.env.TURSO_DATABASE_URL ?? "";
const onVercel = process.env.VERCEL === "1";

if (!onVercel) {
  process.exit(0);
}

const isRemote =
  url.startsWith("libsql:") ||
  url.startsWith("https://") ||
  url.startsWith("http://");

if (!url || url.startsWith("file:") || !isRemote) {
  console.error(
    "\n[Vercel build] TURSO_DATABASE_URL must be set to a Turso libsql:// or https:// URL.\n" +
      "  file:local.db only works for local development.\n" +
      "  Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel → Project → Settings → Environment Variables.\n",
  );
  process.exit(1);
}

if (!process.env.TURSO_AUTH_TOKEN?.trim()) {
  console.error(
    "\n[Vercel build] TURSO_AUTH_TOKEN is required when using a remote Turso database.\n",
  );
  process.exit(1);
}

console.log("[Vercel build] Applying database schema to Turso…");
execSync("npx drizzle-kit push --force", { stdio: "inherit" });

const r2Configured =
  process.env.R2_ACCOUNT_ID?.trim() &&
  process.env.R2_ACCESS_KEY_ID?.trim() &&
  process.env.R2_SECRET_ACCESS_KEY?.trim() &&
  process.env.R2_BUCKET_NAME?.trim();

if (!r2Configured) {
  console.warn(
    "\n[Vercel build] Cloudflare R2 is not configured.\n" +
      "  Add these in Vercel → Project → Settings → Environment Variables (Production + Preview):\n" +
      "    R2_ACCOUNT_ID\n" +
      "    R2_ACCESS_KEY_ID\n" +
      "    R2_SECRET_ACCESS_KEY\n" +
      "    R2_BUCKET_NAME\n" +
      "  Then redeploy. Uploads will return 503 until all four are set.\n",
  );
} else {
  console.log("[Vercel build] R2 storage credentials detected.");
}
