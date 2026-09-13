"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} focusable="false">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.87 8.87 4.76 12 4.76Z"
      />
    </svg>
  );
}

export function GoogleButton({
  mode = "signin",
  className,
}: {
  mode?: "signin" | "signup";
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          try {
            const supabase = createClient();
            const { error: oauthError } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                // Lands on /auth/confirm which swaps the code for a session,
                // auto-provisions a student profile for first-time Google
                // users, then routes to the role home.
                redirectTo: `${window.location.origin}/auth/confirm?next=/`,
                queryParams: { access_type: "offline", prompt: "consent" },
              },
            });
            if (oauthError) setError(oauthError.message);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Google sign-in failed.");
          } finally {
            // OAuth redirects away; only reset if we stayed on the page.
            setLoading(false);
          }
        }}
        className={cn(
          "inline-flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-ink/10 bg-white px-5 py-3 text-sm font-bold text-ink shadow-sm transition",
          "hover:border-ink/20 hover:bg-cream hover:shadow-card",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
          "disabled:pointer-events-none disabled:opacity-60",
          className
        )}
      >
        {loading ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin text-ink-muted" aria-hidden />
        ) : (
          <GoogleIcon className="h-[18px] w-[18px]" />
        )}
        {mode === "signup" ? "Sign up with Google" : "Continue with Google"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-center text-[13px] font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthDivider({ label = "or continue with email" }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-ink/10" />
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </span>
      <span className="h-px flex-1 bg-ink/10" />
    </div>
  );
}
