import type { TypedSupabaseClient } from '@dorsu/supabase-client';
import { ensureStudentRows } from './ensureStudent';

export type AccountSetup =
  | { ok: true; needsStudentDetails: boolean; fullName: string }
  | { ok: false; error: string };

/**
 * Finish account setup after a Google sign-in.
 *
 * Google hands us an email and a display name but never a student number,
 * program, or year level. `ensureStudentRows` is idempotent, so an existing
 * student keeps their row; a first-time Google user gets one with those
 * fields empty (`student_no` has been nullable since 00020) and the caller
 * sends them to the one-time completion form on /register.
 */
export async function finishOAuthAccount(supabase: TypedSupabaseClient): Promise<AccountSetup> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Your Google session expired. Please sign in again.' };

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const read = (key: string) => (typeof meta[key] === 'string' ? (meta[key] as string) : undefined);
  const fullName = read('full_name') ?? read('name') ?? '';

  const ensured = await ensureStudentRows(supabase, user.id, {
    email: user.email ?? '',
    fullName,
  });
  if (!ensured.ok) return { ok: false, error: ensured.error };

  const { data, error } = await supabase
    .from('students')
    .select('student_no, program, year_level')
    .eq('profile_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  const row = data as
    | { student_no: string | null; program: string | null; year_level: string | null }
    | null;
  const needsStudentDetails = !row?.student_no || !row?.program || !row?.year_level;

  return { ok: true, needsStudentDetails, fullName };
}

/** One-time student details collected after a Google sign-up. */
export async function saveStudentDetails(
  supabase: TypedSupabaseClient,
  input: { studentNo: string; program: string; yearLevel: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again to finish setting up.' };

  const { error } = await supabase
    .from('students')
    .update({
      student_no: input.studentNo,
      program: input.program,
      year_level: input.yearLevel,
    })
    .eq('profile_id', user.id);

  if (error) {
    if (/student_no/i.test(error.message) && /duplicate|unique|23505/i.test(error.message)) {
      return { ok: false, error: 'That student number is already registered.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
