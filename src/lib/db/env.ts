export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

export function resolveDatabaseUrl(): string {
  return process.env.TURSO_DATABASE_URL ?? "file:local.db";
}

function isRemoteDatabaseUrl(url: string): boolean {
  return (
    url.startsWith("libsql:") ||
    url.startsWith("https://") ||
    url.startsWith("http://")
  );
}

/** Validates production database settings before connecting or migrating. */
export function assertDatabaseConfigured(): void {
  const url = resolveDatabaseUrl();
  const onVercel = process.env.VERCEL === "1";

  if (!onVercel) return;

  if (url.startsWith("file:")) {
    throw new DatabaseConfigError(
      "Turso is required on Vercel. Set TURSO_DATABASE_URL to your libsql:// database URL and TURSO_AUTH_TOKEN in the Vercel project environment variables (not file:local.db). Then redeploy.",
    );
  }

  if (!isRemoteDatabaseUrl(url)) {
    throw new DatabaseConfigError(
      `TURSO_DATABASE_URL must be a remote Turso URL on Vercel (libsql://… or https://…). Got: ${url.slice(0, 48)}`,
    );
  }

  if (!process.env.TURSO_AUTH_TOKEN?.trim()) {
    throw new DatabaseConfigError(
      "TURSO_AUTH_TOKEN is missing. Add your Turso database auth token in Vercel project settings, then redeploy.",
    );
  }
}
