"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error.digest ?? error.message, error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted">
          PDF Easy Read
        </p>
        <h1 className="font-display mt-2 text-3xl text-foreground">
          Something went wrong
        </h1>
        <p className="mt-4 text-muted">
          Check Vercel runtime logs for the full error. Database setup issues
          usually mean Turso env vars are missing — set{" "}
          <code className="text-sm">TURSO_DATABASE_URL</code> and{" "}
          <code className="text-sm">TURSO_AUTH_TOKEN</code>, then redeploy.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted">
            Error digest: {error.digest}
          </p>
        ) : null}
      </div>
      <button
        className="w-fit rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white"
        onClick={() => reset()}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
