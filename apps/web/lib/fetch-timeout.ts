/**
 * P19: fetch with a hard timeout so hung requests (dead wifi, stalled
 * serverless cold start) surface as a retryable error instead of a
 * permanent spinner. Callers keep their friendly-error mapping; a timeout
 * arrives as Error("Request timed out …") which matches existing fallbacks.
 */

export const FETCH_TIMEOUT_MS = 12_000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  ms: number = FETCH_TIMEOUT_MS,
): Promise<Response> {
  try {
    return await fetch(input, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") {
      throw new Error("Request timed out — please check your connection and retry.");
    }
    throw e;
  }
}
