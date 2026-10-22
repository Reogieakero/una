import type { TypedSupabaseClient } from '@dorsu/supabase-client';

export type AppointmentUpdateInfo = {
  /** When the row last changed (maintained by 00062's updated_at trigger). */
  updatedAt: string;
  /** Display name of the actor, "you" for the student, "Guidance Office" for system writes. */
  name: string;
  /** profiles.role of the actor, or "system" when there is no auth.uid(). */
  role: string;
  isSelf: boolean;
};

type UpdateInfoRow = {
  updated_at: string;
  updated_by_name: string | null;
  updated_by_role: string | null;
  is_self: boolean;
};

/**
 * Reads the student-safe update attribution for one of the caller's own
 * appointments (00064 RPC). The audit trail itself stays head/admin-only;
 * a missing migration or transient failure just hides the badge.
 */
export async function loadAppointmentUpdateInfo(
  db: TypedSupabaseClient,
  appointmentId: string,
): Promise<AppointmentUpdateInfo | null> {
  const { data, error } = await db.rpc('appointment_update_info', {
    p_appointment_id: appointmentId,
  });
  if (error || !data) return null;

  const row = (data as UpdateInfoRow[])[0];
  if (!row) return null;

  return {
    updatedAt: row.updated_at,
    name: row.updated_by_name ?? 'Guidance Office',
    role: row.updated_by_role ?? 'system',
    isSelf: row.is_self === true,
  };
}
