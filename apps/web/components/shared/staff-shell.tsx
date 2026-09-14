import { StaffNav, type StaffNavGroup } from "./staff-nav";
import { StaffShellBody } from "./staff-shell-body";
import type { getCurrentProfile } from "@/lib/supabase/server";

type Profile = Awaited<ReturnType<typeof getCurrentProfile>>;

/**
 * Staff shell — top navigation-menu bar + page content + complementary
 * sidebar (profile, office info, help — never nav links).
 * Side gutters are 16px (px-4) everywhere.
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
  /** Grouped links (groups with 2+ links render as menu dropdowns). */
  groups?: StaffNavGroup[];
  /** Already-fetched profile from the layout guard — avoids a second lookup. */
  profile?: Profile;
  children: React.ReactNode;
}) {
  const resolved: StaffNavGroup[] =
    groups ?? [{ label: "Menu", inline: true, links: links ?? [] }];
  // NOTE: RoutePendingProvider lives in the root layout (one instance for the
  // whole app) — do NOT wrap here, or cross-group navigation would remount it
  // and kill pending state mid-transition.
  return (
    <div className="min-h-screen">
      <StaffNav title={title} groups={resolved} role={profile?.role ?? null} />
      <main className="w-full px-4 py-6">
        <StaffShellBody profile={profile ?? null}>{children}</StaffShellBody>
      </main>
    </div>
  );
}
