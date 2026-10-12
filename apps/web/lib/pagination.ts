/**
 * Shared pagination primitives (plan: numbered pager, ?page=&size= URL state,
 * 10/25/50 selectable, 50 hard max, keyset cursors under the hood).
 */

export const PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 25;
/** Hard ceiling — services clamp to this even if the UI is bypassed. */
export const MAX_PAGE_SIZE = 50;

/** Opaque page cursor (keyset position). Stays in cache; URL holds page/size. */
export type PageCursor = { created_at: string; id: string };

export function clampPageSize(v: unknown): number {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return DEFAULT_PAGE_SIZE;
  if (n <= 10) return 10;
  if (n <= 25) return 25;
  return 50;
}

export function clampPage(v: unknown): number {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(Math.min(n, 1000));
}

/** "Showing 1–25 of ~120" label parts for the current page. */
export function pageRange(page: number, size: number, loaded: number): { start: number; end: number } {
  if (!loaded) return { start: 0, end: 0 };
  const start = (page - 1) * size + 1;
  return { start, end: start + loaded - 1 };
}
