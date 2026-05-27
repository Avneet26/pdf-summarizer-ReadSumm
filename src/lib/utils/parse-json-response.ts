/**
 * Parse a fetch Response as JSON without calling Response.json().
 * Safari throws "The string did not match the expected pattern." when .json()
 * is used on HTML or other non-JSON bodies (e.g. proxy/size-limit error pages).
 */
export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  // Platform layers (e.g. Vercel's edge) return HTML for 413 / 502 errors that
  // never reached the route handler. Convert those into a clear message
  // instead of a generic "Request failed".
  if (!response.ok && !looksLikeJson(text)) {
    throw new Error(friendlyStatusMessage(response.status));
  }

  if (!text) {
    throw new Error(
      response.ok
        ? "Empty response from server."
        : friendlyStatusMessage(response.status),
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.ok
        ? "Invalid response from server."
        : friendlyStatusMessage(response.status),
    );
  }
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function friendlyStatusMessage(status: number): string {
  if (status === 413) {
    return "File is too large to upload. Try a smaller PDF.";
  }
  if (status === 504 || status === 408) {
    return "The request timed out. Check your connection and try again.";
  }
  if (status >= 500) {
    return "The server had a problem handling that request. Please try again.";
  }
  return `Request failed (${status}). Please try again.`;
}
