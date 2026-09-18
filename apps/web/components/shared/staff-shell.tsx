"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { ChekieMark } from "@/components/Logo";
import { StaffNav, type StaffNavGroup } from "./staff-nav";
import { SidebarNavGroups, StaffSidebar, StaffSidebarSkeleton, type SidebarProfile } from "./staff-sidebar";
import { StaffShellBody } from "./staff-shell-body";

/**
 * Staff shell — left navigation rail (shadcn blocks style, 240px) +
 * slim top bar + page content. The top bar carries no links; all links
 * live in the sidebar for admin, counselor, and staff alike.
 */
export function StaffShell({
  title,
  links,
  groups,
  profile,
  children,
}: {
  title: string;
  /** Flat links (rendered as direct menu items). Kept for backwards compat. */
  links?: { href: string; label: string; desc?: string }[];
  /** Grouped links rendered in the sidebar rail. */
  groups?: StaffNavGroup[];
  /** Already-fetched profile from the layout guard — avoids a second lookup. */
  profile?: SidebarProfile;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const resolved: StaffNavGroup[] =
    groups ?? [{ label: "Menu", inline: true, links: links ?? [] }];
  const role = profile?.role ?? null;

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  // NOTE: RoutePendingProvider lives in the root layout (one instance for the
  // whole app) — do NOT wrap here, or cross-group navigation would remount it
  // and kill pending state mid-transition.
  return (
    <div className="min-h-screen">
      {/* Global toasts + bell counts live in RealtimeProvider (root layout) —
          no per-shell subscription here. */}
      <div className="flex min-h-screen items-stretch">
        <Suspense fallback={<StaffSidebarSkeleton />}>
          <StaffSidebar groups={resolved} role={role} />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <StaffNav title={title} profile={profile ?? null} onMenuClick={() => setMenuOpen(true)} />
          <main className="w-full flex-1 p-4">
            <StaffShellBody>{children}</StaffShellBody>
          </main>
        </div>
      </div>

      {/* Mobile drawer — same sidebar content in a narrow 240px panel. */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Workspace navigation">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="absolute inset-y-0 left-0 flex w-60 max-w-[85vw] flex-col bg-white shadow-card">
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-ink/10 px-4">
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="flex min-w-0 flex-1 items-center gap-2"
                aria-label="Chekie — back to home"
              >
                <ChekieMark size={32} label="Chekie panda mascot" />
                <span className="leading-tight">
                  <span className="block font-display text-[15px] font-semibold">Chekie</span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                    {title}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-8 w-8 items-center justify-center rounded text-ink-soft transition hover:bg-cream-dark hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <SidebarNavGroups groups={resolved} role={role} onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
