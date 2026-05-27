export const SINGLE_USER_ID = "default";

// Vercel serverless functions cap the request body at ~4.5 MB. We stay
// comfortably below that to leave headroom for multipart envelope + headers.
// Override via NEXT_PUBLIC_MAX_UPLOAD_MB when self-hosting behind a proxy that
// allows larger payloads. The same value is referenced on the client and the
// server so the size check stays consistent.
const DEFAULT_MAX_UPLOAD_MB = 4;

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
