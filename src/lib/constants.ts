export const SINGLE_USER_ID = "default";

// Uploads go directly from the browser to Cloudflare R2 via a presigned URL,
// so the Vercel ~4.5 MB serverless body limit no longer applies. We still cap
// the size to keep memory bounded when the server downloads the staged file
// for processing. Override via NEXT_PUBLIC_MAX_UPLOAD_MB to taste.
const DEFAULT_MAX_UPLOAD_MB = 50;

/** Vercel serverless request body limit — server fallback only works below this. */
export const VERCEL_UPLOAD_BODY_BYTES = 4 * 1024 * 1024;

function parseMaxUploadMb(): number {
  const raw = process.env.NEXT_PUBLIC_MAX_UPLOAD_MB;
  if (!raw) return DEFAULT_MAX_UPLOAD_MB;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_UPLOAD_MB;
  return parsed;
}

export const MAX_UPLOAD_MB = parseMaxUploadMb();
export const MAX_UPLOAD_BYTES = Math.floor(MAX_UPLOAD_MB * 1024 * 1024);

export function formatMaxUploadLimit(): string {
  return Number.isInteger(MAX_UPLOAD_MB)
    ? `${MAX_UPLOAD_MB} MB`
    : `${MAX_UPLOAD_MB.toFixed(1)} MB`;
}

export const PAGE_CHUNK_SIZE = 5;

export const MIN_CHUNK_WORDS = 300;

export const MAX_CHUNK_CHARS = 10000;

export const AI_CONCURRENCY = 10;

export const AI_MAX_RETRIES = 2;

export const FAILURE_THRESHOLD = 0.2;

export const MIN_TEXT_CHARS_PER_PAGE = 50;

export const ACCENT_COLORS = [
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
];
