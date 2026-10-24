import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cancelAppointment, isWithinStudentRescheduleWindow } from '@dorsu/shared-services';
import type { AppointmentRow } from '@dorsu/shared-types';
import { getSupabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import {
  loadAppointmentUpdateInfo,
  type AppointmentUpdateInfo,
} from '@/lib/appointment-updates';
import { cardRadius, colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { Button } from '@/components/Button';
import { StatusChip } from '@/components/StatusChip';

type Props = {
  /** Appointment whose details are open (null closes the sheet). */
  appointment: AppointmentRow | null;
  /** Appointment awaiting cancel confirmation (null hides that modal). */
  cancelTarget: AppointmentRow | null;
  counselorName?: string;
  counselorSpecialty?: string;
  onClose: () => void;
  /** Parent closes this sheet and opens its shared `RescheduleModal`. */
  onRequestReschedule: (appointment: AppointmentRow) => void;
  onRequestCancel: (appointment: AppointmentRow) => void;
  onCancelClose: () => void;
  /** Parent patches/removes its own row after a successful cancel. */
  onCancelled?: (appointment: AppointmentRow) => void;
};

const ACTIVE = ['pending', 'assigned', 'confirmed'];

const ROLE_LABEL: Record<string, string> = {
  counselor: 'Counselor',
  guidance_head: 'Guidance Head',
  admin: 'Admin',
  guidance_personnel: 'Guidance Personnel',
  faculty: 'Faculty',
};

/** One-line attribution for the update badge. */
function updateLabel(info: AppointmentUpdateInfo): string {
  if (info.isSelf) return 'Updated by you';
  if (info.name === 'Guidance Office') return 'Updated by the Guidance Office';
  const role = ROLE_LABEL[info.role];
  return role ? `Updated by ${info.name} · ${role}` : `Updated by ${info.name}`;
}

/** Full date for the details sheet (local device time). */
function longDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function scheduleRange(row: AppointmentRow): string {
  const start = longDate(row.scheduled_at);
  if (!row.ends_at) return start;
  const end = new Date(row.ends_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${start} – ${end}`;
}

function titleFor(row: AppointmentRow): string {
  const base = row.concern.replace(/\s+support session requested$/i, '').trim();
  return base === '' ? 'Counseling session' : `${base} session`;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

/**
 * Student session details + cancel confirmation, shared by Home and the
 * Sessions tab so both surfaces stay identical. Closes by tapping the
 * backdrop (no in-sheet close control); cancel is a custom red-action modal.
 */
export function SessionDetailsModal({
  appointment,
  cancelTarget,
  counselorName,
  counselorSpecialty,
  onClose,
  onRequestReschedule,
  onRequestCancel,
  onCancelClose,
  onCancelled,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [updateInfo, setUpdateInfo] = useState<AppointmentUpdateInfo | null>(null);
  const [updateInfoFor, setUpdateInfoFor] = useState<string | null>(null);

  const appointmentId = appointment?.id ?? null;
  const appointmentUpdatedAt = appointment?.updated_at ?? null;

  // Attribution is fetched when the sheet opens and again whenever the row's
  // updated_at changes (e.g. after a reschedule), so the badge never shows a
  // stale actor. Failures leave the badge hidden.
  useEffect(() => {
    if (!appointmentId) return;
    let alive = true;
    void (async () => {
      const info = await loadAppointmentUpdateInfo(getSupabase(), appointmentId);
      if (!alive) return;
      setUpdateInfo(info);
      setUpdateInfoFor(appointmentId);
    })();
    return () => {
      alive = false;
    };
  }, [appointmentId, appointmentUpdatedAt]);

  const update = updateInfoFor === appointmentId ? updateInfo : null;
  const wasUpdated =
    update !== null &&
    appointment !== null &&
    new Date(update.updatedAt).getTime() >
      new Date(appointment.created_at).getTime() + 1000;

  const nowMs = new Date().getTime();
  const active =
    appointment !== null &&
    ACTIVE.includes(appointment.status) &&
    new Date(appointment.scheduled_at).getTime() >= nowMs;
  const canReschedule =
    active &&
    (appointment.status === 'pending' ||
      appointment.status === 'assigned' ||
      (appointment.status === 'confirmed' &&
        isWithinStudentRescheduleWindow(appointment.scheduled_at)));

  const doCancel = async () => {
    if (!cancelTarget || busy) return;
    setError('');
    setBusy(true);
    try {
      await cancelAppointment(getSupabase(), cancelTarget.id);
      onCancelled?.(cancelTarget);
      onCancelClose();
    } catch (e) {
      setError(errorMessage(e, 'Could not cancel the session.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        visible={appointment !== null}
        transparent
        animationType="fade"
        onRequestClose={onClose}
        onShow={() => setError('')}
      >
        <Pressable
          style={styles.modalBg}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close session details"
        >
          <Pressable style={styles.modal} onPress={() => undefined}>
            <Text style={styles.modalTitle}>Session details</Text>

            {appointment ? (
              <>
                <Text style={styles.modalSession}>{titleFor(appointment)}</Text>
                <View style={styles.badgeRow}>
                  <StatusChip status={appointment.status} />
                  {wasUpdated && update ? (
                    <View style={styles.updateBadge}>
                      <Text style={styles.updateBadgeText} numberOfLines={1}>
                        {updateLabel(update)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <Detail label="When" value={scheduleRange(appointment)} />
                  <Detail
                    label="Mode"
                    value={
                      appointment.mode === 'online' ? 'Online' : 'In person · Guidance Office'
                    }
                  />
                  <Detail
                    label="Assigned counselor"
                    value={
                      appointment.counselor_id
                        ? (counselorName ?? 'Assigned counselor')
                        : 'Not assigned yet'
                    }
                  />
                  {counselorSpecialty !== undefined ? (
                    <Detail label="Specialization" value={counselorSpecialty} />
                  ) : null}
                  {appointment.mode === 'online' && appointment.meeting_url ? (
                    <Detail label="Video link" value={appointment.meeting_url} />
                  ) : null}
                  <Detail label="Reference" value={appointment.id.slice(0, 8).toUpperCase()} />
                  <Detail label="Booked on" value={longDate(appointment.created_at)} />

                  {appointment.counselor_id === null ? (
                    <Text style={styles.modalNote}>
                      The guidance head assigns a counselor after your request. Their name will
                      appear here once it is assigned.
                    </Text>
                  ) : null}

                  {appointment.status === 'confirmed' ? (
                    <Text style={styles.modalNote}>
                      {canReschedule
                        ? 'Your counselor confirmed this session. You can still move it until 24 hours before it starts.'
                        : 'This session starts within 24 hours. Contact the Guidance Office if you need to move it.'}
                    </Text>
                  ) : null}
                </ScrollView>

                {active ? (
                  <View style={styles.btns}>
                    {canReschedule ? (
                      <Button
                        label="Reschedule"
                        variant="outline"
                        style={styles.flex}
                        onPress={() => onRequestReschedule(appointment)}
                      />
                    ) : null}
                    <Button
                      label="Cancel session"
                      variant="dangerOutline"
                      style={styles.flex}
                      onPress={() => onRequestCancel(appointment)}
                    />
                  </View>
                ) : null}

                <Text style={styles.modalHint}>Tap outside to close</Text>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={cancelTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) onCancelClose();
        }}
        onShow={() => setError('')}
      >
        <Pressable
          style={styles.modalBg}
          onPress={() => {
            if (!busy) onCancelClose();
          }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss cancel confirmation"
        >
          <Pressable style={styles.modal} onPress={() => undefined}>
            {cancelTarget ? (
              <>
                <Text style={styles.modalTitle}>Cancel this session?</Text>
                <Text style={styles.modalSession}>{titleFor(cancelTarget)}</Text>
                <Text style={styles.meta}>{scheduleRange(cancelTarget)}</Text>
                <Text style={styles.modalNote}>
                  This can’t be undone. You can book a new session anytime.
                </Text>

                {error !== '' ? <Text style={styles.modalErr}>{error}</Text> : null}

                <View style={styles.btns}>
                  <Button
                    label="Keep session"
                    variant="outline"
                    disabled={busy}
                    style={styles.flex}
                    onPress={onCancelClose}
                  />
                  <Button
                    label={busy ? 'Cancelling…' : 'Yes, cancel'}
                    variant="danger"
                    disabled={busy}
                    style={styles.flex}
                    onPress={() => void doCancel()}
                  />
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(20,49,92,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.white,
    borderRadius: cardRadius,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '85%',
  },
  modalTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  modalSession: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  updateBadge: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.sun,
    backgroundColor: colors.sunSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  updateBadgeText: {
    flexShrink: 1,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.ink,
  },
  modalScroll: { flexShrink: 1 },
  modalScrollContent: { paddingTop: spacing.xs },
  modalNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  modalHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xxs,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  modalErr: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.danger },
  meta: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
  detail: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.creamLine,
    gap: 2,
  },
  detailLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  detailValue: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.ink },
});
