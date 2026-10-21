import type { TypedSupabaseClient } from '@dorsu/supabase-client';

function isConflict(message: string): boolean {
  return /duplicate|unique|23505|already exists|already registered/i.test(message);
}

function makeAlias(): string {
  return `Client-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function friendlyDbError(message: string): string {
  if (/student_no/i.test(message) && isConflict(message)) {
    return 'That student number is already registered.';
  }
  if (isConflict(message)) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  return message;
}

/**
 * Ensure `profiles` + `students` rows exist for an authenticated student.
 * RLS (00030 `profiles_insert_own_student`, `students_insert_own`) lets a
 * signed-in user insert exactly their own rows with role forced to
 * 'student'. Safe to call on every login: existing rows are left alone.
 */
export async function ensureStudentRows(
  supabase: TypedSupabaseClient,
  userId: string,
  fields: { email: string; fullName: string; studentNo?: string; program?: string; yearLevel?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: profile, error: profileReadError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (profileReadError) return { ok: false, error: profileReadError.message };
  if (!profile) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      email: fields.email,
      role: 'student',
      full_name: fields.fullName,
    });
    if (profileError && !isConflict(profileError.message)) {
      return { ok: false, error: profileError.message };
    }
  }
  if (fields.studentNo) {
    const { data: student, error: studentReadError } = await supabase
      .from('students')
      .select('profile_id')
      .eq('profile_id', userId)
      .maybeSingle();
    if (studentReadError) return { ok: false, error: studentReadError.message };
    if (!student) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error: studentError } = await supabase.from('students').insert({
          profile_id: userId,
          student_no: fields.studentNo,
          program: fields.program ?? null,
          year_level: fields.yearLevel ?? null,
          anonymous_alias: makeAlias(),
        });
        if (!studentError) return { ok: true };
        if (/anonymous_alias/i.test(studentError.message) && isConflict(studentError.message)) {
          continue; // alias collision — retry with a fresh one
        }
        return { ok: false, error: studentError.message };
      }
      return { ok: false, error: 'Could not finish account setup. Please try again.' };
    }
  }
  return { ok: true };
}
