/**
 * Error text for UI. Supabase/PostgREST failures are plain objects
 * (`{ message, details, hint, code }`), not `Error` instances, so a plain
 * `e instanceof Error` check would hide the real cause behind a generic
 * fallback. Prefer a non-empty `message` from either shape.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim() !== '') return message;
  }
  return fallback;
}
