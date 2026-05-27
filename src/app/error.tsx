"use client";

import { useEffect } from "react";

function isDatabaseSetupError(message: string): boolean {
  return (
    message.includes("Turso") ||
    message.includes("TURSO_") ||
    message.includes("no such table") ||
    message.includes("DatabaseConfigError") ||
    message.includes("Database is not configured")
  );
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const setup = isDatabaseSetupError(error.message);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">
          PDF Easy Read
        </p>
        <h1 className="font-display mt-2 text-3xl text-foreground">
          {setup ? "Database not configured" : "Something went wrong"}
        </h1>
        <p className="mt-4 text-muted">
          {setup
            ? "The app could not connect to Turso on this deployment. Add your database environment variables in Vercel, run the schema once, then redeploy."
            : "An unexpected error occurred while loading this page."}
        </p>
      </div>

      {setup ? (
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
          <li>
            Create a database at{" "}
            <a
              className="text-accent underline"
              href="https://turso.tech/"
              rel="noreferrer"
              target="_blank"
            >
              turso.tech
            </a>{" "}
            and copy the <code className="text-sm">libsql://</code> URL.
          </li>
          <li>
            In Vercel → Project → Settings → Environment Variables, set{" "}
            <code className="text-sm">TURSO_DATABASE_URL</code> and{" "}
            <code className="text-sm">TURSO_AUTH_TOKEN</code> for Production
            (and Preview if you use preview deploys).
          </li>
          <li>
            Locally run <code className="text-sm">npm run db:push</code> once
            with those values, or redeploy so the build step applies the schema.
          </li>
        </ol>
      ) : (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 font-mono text-sm text-muted">
          {error.message}
        </p>
      )}

      <button
        className="w-fit rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white"
        onClick={() => reset()}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
