import type { TypedSupabaseClient } from '@dorsu/supabase-client';

export type CounselorDirectory = {
  /** counselor_id -> display name (active counselors only, via 00049 RPC). */
  names: Record<string, string>;
  /** counselor_id -> specialization (nullable column, omitted when empty). */
  specialties: Record<string, string>;
  /** counselor_id -> profile role (00074 RPC; empty until the migration lands). */
  roles: Record<string, string>;
};

/**
 * Best-effort counselor lookup for student-facing session cards. Profiles are
 * staff-only under RLS, so names come from the `counselor_directory()`
 * SECURITY DEFINER RPC; a failure here must never block sessions from
 * rendering (both queries resolve with `{ data: null, error }`).
 */
export async function loadCounselorDirectory(
  db: TypedSupabaseClient,
): Promise<CounselorDirectory> {
  const [directoryRes, specialtiesRes] = await Promise.all([
    db.rpc('counselor_directory'),
    db.from('counselors').select('id, specialization'),
  ]);

  const names: Record<string, string> = {};
  const roles: Record<string, string> = {};
  for (const c of (directoryRes.data ?? []) as {
    counselor_id: string;
    display_name: string;
    profile_role?: string | null;
  }[]) {
    names[c.counselor_id] = c.display_name;
    if (c.profile_role) roles[c.counselor_id] = c.profile_role;
  }

  const specialties: Record<string, string> = {};
  for (const c of (specialtiesRes.data ?? []) as {
    id: string;
    specialization: string | null;
  }[]) {
    if (c.specialization) specialties[c.id] = c.specialization;
  }

  return { names, specialties, roles };
}
