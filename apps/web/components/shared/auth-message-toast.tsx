"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Surfaces Supabase Auth redirect messages (?message= / #message=) as a
 * toast, then scrubs them from the URL. Without this, confirmations land on
 * a page that silently swallows what just happened.
 */
export function AuthMessageToast() {
  const params = useSearchParams();

  useEffect(() => {
    let msg = params.get("message");
    if (!msg && typeof window !== "undefined" && window.location.hash.includes("message=")) {
      msg = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("message");
    }
    if (!msg) return;
    toast.success(msg);
    const url = new URL(window.location.href);
    url.searchParams.delete("message");
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    hashParams.delete("message");
    // Supabase leaves an empty sb= marker behind — drop it so no stray # remains.
    if (!hashParams.get("sb")) hashParams.delete("sb");
    const rest = hashParams.toString();
    url.hash = rest ? `#${rest}` : "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return null;
}
