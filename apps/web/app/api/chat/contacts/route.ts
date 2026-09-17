import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ChatContact = {
  profileId: string;
  name: string;
  role: string;
  detail: string | null;
};

/**
 * GET /api/chat/contacts — office contact directory for faculty chat.
 * Faculty clients cannot read other profiles (RLS intentionally excludes
 * them), so the server resolves names for the narrow set faculty may
 * message: active counselors + the active guidance head. Only profile id,
 * name, role, and specialization leave this route — no emails or rows.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string; is_active?: boolean | null } | null)?.role;
  if ((profile as { is_active?: boolean | null } | null)?.is_active === false) {
    return NextResponse.json({ error: "Account deactivated." }, { status: 403 });
  }
  if (role !== "faculty") {
    return NextResponse.json({ error: "Faculty only." }, { status: 403 });
  }

  const admin = createAdminClient();
  const [{ data: counselorRows }, { data: heads }] = await Promise.all([
    admin.from("counselors").select("id, profile_id, specialization"),
    admin.from("profiles").select("id, full_name").eq("role", "guidance_head").eq("is_active", true),
  ]);
  const counselors = ((counselorRows ?? []) as { id: string; profile_id: string; specialization: string | null }[]);
  const byProfile = new Map<string, string>();
  const counselorProfileIds = [...new Set(counselors.map((c) => c.profile_id).filter(Boolean))];
  if (counselorProfileIds.length) {
    const { data: staff } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", counselorProfileIds)
      .eq("is_active", true);
    for (const p of ((staff ?? []) as { id: string; full_name: string | null }[])) {
      byProfile.set(p.id, p.full_name ?? "Counselor");
    }
  }

  const contacts: ChatContact[] = [
    ...counselors
      .filter((c) => byProfile.has(c.profile_id))
      .map((c) => ({
        profileId: c.profile_id,
        name: byProfile.get(c.profile_id) ?? "Counselor",
        role: "counselor",
        detail: c.specialization,
      })),
    ...(((heads ?? []) as { id: string; full_name: string | null }[]).map((h) => ({
      profileId: h.id,
      name: h.full_name ?? "Guidance Head",
      role: "guidance_head",
      detail: null,
    }))),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(
    { contacts },
    { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=60" } }
  );
}
