import type { QueryClient } from "@tanstack/react-query";

/**
 * Generic react-query board patcher.
 * Replaces the per-page `patchBoard` copies in chat/notifications
 * (identical logic, different key/data types). Realtime arrivals
 * patch the cache in place so lists never flash.
 */
export function patchBoard<TData>(
  qc: QueryClient,
  key: readonly unknown[],
  patch: (prev: TData) => TData
) {
  qc.setQueryData<TData>([...key], (prev) => (prev ? patch(prev) : prev));
}
