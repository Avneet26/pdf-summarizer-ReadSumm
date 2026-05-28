/** Avoid storing HTML error pages in the database. */
export function sanitizeErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "Something went wrong. Please try again.";

  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return "Server processing failed. Please try uploading again in a minute.";
  }

  if (trimmed.includes("DOMMatrix is not defined")) {
    return "PDF processing failed to start on the server. Redeploy the latest build and try again.";
  }

  if (trimmed.length > 500) {
    return `${trimmed.slice(0, 500)}…`;
  }

  return trimmed;
}
