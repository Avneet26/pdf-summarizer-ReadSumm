/**
 * Parse a fetch Response as JSON without calling Response.json().
 * Safari throws "The string did not match the expected pattern." when .json()
 * is used on HTML or other non-JSON bodies (e.g. proxy/size-limit error pages).
 */
export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    throw new Error(
      response.ok
        ? "Empty response from server."
        : `Request failed (${response.status}).`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.ok
        ? "Invalid response from server."
        : `Request failed (${response.status}). Please try again.`,
    );
  }
}
