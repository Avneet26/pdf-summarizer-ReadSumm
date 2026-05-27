import { DatabaseConfigError } from "@/lib/db/env";

function formatError(error: unknown): string {
  if (error instanceof DatabaseConfigError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unknown database error";
}

export function SetupRequired({ error }: { error: unknown }) {
  const message = formatError(error);
  const isConfig = error instanceof DatabaseConfigError;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">
          PDF Easy Read
        </p>
        <h1 className="font-display mt-2 text-3xl text-foreground">
          {isConfig ? "Database not configured" : "Could not load library"}
        </h1>
        <p className="mt-4 text-muted">
          {isConfig
            ? "Turso environment variables are missing or invalid for this deployment."
            : "The app could not reach your Turso database. Check the connection URL, auth token, and that tables exist."}
        </p>
      </div>

      <p className="rounded-lg border border-stone-300/80 bg-white/60 px-4 py-3 font-mono text-sm text-foreground">
        {message}
      </p>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
        <li>
          In Vercel → Settings → Environment Variables, set{" "}
          <code className="text-sm">TURSO_DATABASE_URL</code> (
          <code className="text-sm">libsql://…</code>, not{" "}
          <code className="text-sm">file:local.db</code>) and{" "}
          <code className="text-sm">TURSO_AUTH_TOKEN</code>.
        </li>
        <li>Redeploy after saving env vars (a new deployment is required).</li>
        <li>
          Optional: run <code className="text-sm">npm run db:push</code> locally
          with the same Turso credentials to verify the schema.
        </li>
      </ol>
    </div>
  );
}
