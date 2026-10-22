"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { isExternalAvatar } from "@dorsu/shared-services";

/**
 * Resolve `profiles.avatar_url` (an OAuth URL or an `avatars` object path)
 * into something an <img> can render. The bucket is private, so uploaded
 * photos are exchanged for a 1-hour signed URL; storage RLS decides whether
 * this viewer is allowed to sign it. Signed URLs are cached for 45 minutes.
 */
export function useAvatarUrl(value: string | null | undefined) {
  return useQuery({
    queryKey: ["avatar", "url", value ?? null],
    enabled: !!value,
    staleTime: 45 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<string | null> => {
      if (!value) return null;
      if (isExternalAvatar(value)) return value;
      const { data, error } = await createClient()
        .storage.from("avatars")
        .createSignedUrl(value, 60 * 60);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  });
}
