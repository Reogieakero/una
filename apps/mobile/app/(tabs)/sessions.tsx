import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { listStudentAppointments, preSessionPss10State, isWithinStudentRescheduleWindow, submitFeedback } from '@dorsu/shared-services';
import type { AppointmentRow } from '@dorsu/shared-types';
import { getSupabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { loadCounselorDirectory } from '@/lib/counselors';
import { colors, fontFamily, fontSize, spacing } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { CounselorPill } from '@/components/CounselorPill';
import { RescheduleModal } from '@/components/RescheduleModal';
import { SessionDetailsModal } from '@/components/SessionDetailsModal';
import { StatusChip } from '@/components/StatusChip';
import { StarRating } from '@/components/StarRating';

type Tab = 'Upcoming' | 'Past' | 'Canceled';
const tabs: Tab[] = ['Upcoming', 'Past', 'Canceled'];

const ACTIVE = ['pending', 'assigned', 'confirmed'];

function timeOf(iso: string): { month: string; day: string; when: string } {
  const d = new Date(iso);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = String(d.getDate());
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return { month, day, when: `${weekday} · ${h}:${m} ${ampm}` };
}

function titleFor(row: AppointmentRow): string {
  const base = row.concern.replace(/\s+support session requested$/i, '').trim();
  return base === '' ? 'Counseling session' : `${base} session`;
}

function modeLabel(row: AppointmentRow): string {
  return row.mode === 'online' ? 'Online' : 'In person · Guidance Office';
}

export default function Sessions() {
  const [tab, setTab] = useState<Tab>('Upcoming');
  const [rows, setRows] = useState<AppointmentRow[] | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [checkins, setCheckins] = useState(0);
  const [checkinByAppt, setCheckinByAppt] = useState<Record<string, string>>({});
  const [rated, setRated] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [fbBusyId, setFbBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentRow | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRow | null>(null);
  // Counselor lookup for the details sheet. `counselor_directory()` is the
  // RLS-safe SECURITY DEFINER directory (00049); profiles are staff-only.
  const [counselorNames, setCounselorNames] = useState<Record<string, string>>({});
  const [counselorSpecialties, setCounselorSpecialties] = useState<Record<string, string>>({});

  // Live read: own appointments + existing feedback + check-in count.
  // Re-runs on tab focus and on pull-to-refresh so staff-side changes
  // (assign/confirm/complete) appear without a re-login.
  const load = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setRows([]);
        setError('Please log in again to see your sessions.');
        return;
      }
      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (!student) {
        setRows([]);
        setError('Your student profile is still being set up. Pull down to refresh.');
        return;
      }
      const sid = student.id;
      const [appts, feedbackRes, pssRes, directory] = await Promise.all([
        listStudentAppointments(supabase, sid),
        supabase.from('feedback').select('appointment_id, rating').eq('student_id', sid),
        supabase
          .from('pss10_assessments')
          .select('id, appointment_id, created_at', { count: 'exact' })
          .eq('student_id', sid)
          .order('created_at', { ascending: false }),
        // Best-effort: sessions must still render if the directory lookup fails.
        loadCounselorDirectory(supabase),
      ]);
      const feedbackMap: Record<string, number> = {};
      for (const f of (feedbackRes.data ?? []) as { appointment_id: string; rating: number }[]) {
        feedbackMap[f.appointment_id] = f.rating;
      }
      // Newest linked check-in per appointment (retakes allowed since 00068).
      // The query is ordered newest-first, so the first row wins.
      const checkinMap: Record<string, string> = {};
      for (const p of (pssRes.data ?? []) as {
        appointment_id: string | null;
        created_at: string;
      }[]) {
        if (p.appointment_id && !checkinMap[p.appointment_id]) {
          checkinMap[p.appointment_id] = p.created_at;
        }
      }
      setStudentId(sid);
      setRows(((appts ?? []) as AppointmentRow[]));
      setRated(feedbackMap);
      setCheckins(pssRes.count ?? 0);
      setCheckinByAppt(checkinMap);
      setCounselorNames(directory.names);
      setCounselorSpecialties(directory.specialties);
      setError('');
    } catch (e) {
      setRows((prev) => prev ?? []);
      setError(errorMessage(e, 'Could not load your sessions.'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const { upcoming, past, canceled } = useMemo(() => {
    // `new Date()` is allowed by the purity lint (Date.now is not); grouping
    // refreshes whenever the row set changes or the screen regains focus.
    const now = new Date().getTime();
    const all = rows ?? [];
    const isActive = (r: AppointmentRow) => ACTIVE.includes(r.status);
    const upcomingRows = all
      .filter((r) => isActive(r) && new Date(r.scheduled_at).getTime() >= now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    const pastRows = all
      .filter(
        (r) =>
          r.status === 'completed' ||
          r.status === 'no_show' ||
          (isActive(r) && new Date(r.scheduled_at).getTime() < now),
      )
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    const canceledRows = all
      .filter((r) => r.status === 'cancelled' || r.status === 'rejected')
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
    return { upcoming: upcomingRows, past: pastRows, canceled: canceledRows };
  }, [rows]);

  const completedCount = (rows ?? []).filter((r) => r.status === 'completed').length;
  const list = tab === 'Upcoming' ? upcoming : tab === 'Past' ? past : canceled;
  const loading = rows === null;
  const nowMs = new Date().getTime();
  const selected = openId === null ? null : (rows ?? []).find((r) => r.id === openId) ?? null;
  const selectedSpecialty = selected?.counselor_id
    ? counselorSpecialties[selected.counselor_id]
    : undefined;

  // Shared details/cancel/reschedule sheets: closing the details first keeps a
  // single modal on screen at a time.
  const requestCancel = (row: AppointmentRow) => {
    setOpenId(null);
    setCancelTarget(row);
  };

  const requestReschedule = (row: AppointmentRow) => {
    setOpenId(null);
    setRescheduleTarget(row);
  };

  const applyCancelled = (row: AppointmentRow) => {
    setRows((prev) =>
      prev?.map((r) => (r.id === row.id ? { ...r, status: 'cancelled' } : r)) ?? prev,
    );
    setCancelTarget(null);
  };

  const applyRescheduled = (updated: AppointmentRow) => {
    setRows((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? prev);
  };

  const sendFeedback = async (row: AppointmentRow) => {
    const rating = draft[row.id];
    if (!studentId || !rating) return;
    setFbBusyId(row.id);
    setError('');
    try {
      await submitFeedback(getSupabase(), {
        appointmentId: row.id,
        studentId,
        rating,
      });
      setRated((prev) => ({ ...prev, [row.id]: rating }));
    } catch (e) {
      setError(errorMessage(e, 'Could not send your rating.'));
    } finally {
      setFbBusyId(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />
          }
        >
          <View style={styles.head}>
            <Text style={styles.title}>My sessions</Text>
            <Button label="+ Book new" variant="accent" onPress={() => router.push('/book')} />
          </View>

          <View style={styles.stats}>
            <Card style={[styles.stat, styles.statBlue]}>
              <Text style={[styles.statN, styles.statNLight]}>{loading ? '—' : upcoming.length}</Text>
              <Text style={[styles.statL, styles.statLLight]}>Upcoming</Text>
            </Card>
            <Card style={styles.stat}>
              <Text style={styles.statN}>{loading ? '—' : completedCount}</Text>
              <Text style={styles.statL}>Completed</Text>
            </Card>
            <Card style={styles.stat}>
              <Text style={styles.statN}>{loading ? '—' : checkins}</Text>
              <Text style={styles.statL}>Check-ins</Text>
            </Card>
          </View>

          <View style={styles.tabs}>
            {tabs.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t }}
                style={styles.tabWrap}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {error !== '' ? (
            <Card style={styles.errCard}>
              <Text style={styles.errText}>{error}</Text>
              <View style={styles.mt}>
                <Button label="Try again" variant="outline" onPress={() => void load()} />
              </View>
            </Card>
          ) : null}

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.blue} />
              <Text style={styles.emptySub}>Loading your sessions…</Text>
            </View>
          ) : list.length === 0 ? (
            <Card>
              <Text style={styles.emptyTitle}>
                {tab === 'Canceled'
                  ? 'No canceled sessions'
                  : tab === 'Past'
                    ? 'No past sessions yet'
                    : 'No upcoming sessions'}
              </Text>
              <Text style={styles.emptySub}>
                {tab === 'Canceled'
                  ? 'Canceled requests will show up here.'
                  : tab === 'Past'
                    ? 'Completed sessions and ratings appear here.'
                    : 'Book when you are ready. We are here.'}
              </Text>
              {tab !== 'Canceled' ? (
                <View style={styles.mt}>
                  <Button label="Book a session" onPress={() => router.push('/book')} />
                </View>
              ) : null}
            </Card>
          ) : (
            list.map((a) => {
              const { month, day, when } = timeOf(a.scheduled_at);
              const isActive = ACTIVE.includes(a.status) && new Date(a.scheduled_at).getTime() >= nowMs;
              const checkinState = preSessionPss10State({
                required: a.pss10_required,
                waivedAt: a.pss10_waived_at,
                scheduledAt: a.scheduled_at,
                submittedAt: checkinByAppt[a.id] ?? null,
              });
              const needsCheckin =
                isActive &&
                a.status === 'confirmed' &&
                (checkinState === 'missing' || checkinState === 'expired');
              const checkinDone = a.status === 'confirmed' && checkinState === 'complete';
              const canReschedule =
                a.status === 'pending' ||
                a.status === 'assigned' ||
                (a.status === 'confirmed' &&
                  isActive &&
                  isWithinStudentRescheduleWindow(a.scheduled_at));
              const counselorName = a.counselor_id ? counselorNames[a.counselor_id] : undefined;
              const sent = rated[a.id];
              return (
                <View key={a.id} style={styles.row}>
                  <View style={styles.rail}>
                    <Text style={styles.month}>{month}</Text>
                    <Text style={styles.dayNum}>{day}</Text>
                    <View
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            a.status === 'confirmed'
                              ? colors.blue
                              : a.status === 'pending' || a.status === 'assigned'
                                ? colors.sun
                                : colors.muted,
                        },
                      ]}
                    />
                    <View style={styles.line} />
                  </View>
                  <Pressable
                    onPress={() => setOpenId(a.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Session details for ${titleFor(a)}`}
                    style={styles.cardPress}
                  >
                    <Card style={styles.card}>
                      <Text style={styles.cardTitle}>{titleFor(a)}</Text>
                      <Text style={styles.meta}>
                        {when} · {modeLabel(a)}
                      </Text>
                      <View style={[styles.mt, styles.pills]}>
                        <StatusChip status={a.status} />
                        <CounselorPill assigned={a.counselor_id !== null} name={counselorName} />
                      </View>

                      {checkinDone ? (
                        <Text style={styles.checkinOk}>
                          Pre-session check-in complete
                          {checkinByAppt[a.id]
                            ? ` · ${new Date(checkinByAppt[a.id]).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}`
                            : ''}
                        </Text>
                      ) : null}

                      {needsCheckin ? (
                        <View style={styles.mt}>
                          <Text style={styles.checkinNeeded}>
                            {checkinState === 'expired'
                              ? 'Your last check-in is older than 7 days. Complete a fresh one before this session.'
                              : 'Complete a short check-in so your counselor can prepare for this session.'}
                          </Text>
                          <Button
                            label="Pre-session check-in"
                            onPress={() =>
                              router.push({
                                pathname: '/check-in',
                                params: { appointmentId: a.id },
                              })
                            }
                          />
                        </View>
                      ) : null}

                      {isActive ? (
                        <View style={styles.btns}>
                          {canReschedule ? (
                            <Button
                              label="Reschedule"
                              variant="outline"
                              onPress={() => requestReschedule(a)}
                              style={styles.flex}
                            />
                          ) : null}
                          <Button
                            label="Cancel"
                            variant="dangerOutline"
                            onPress={() => requestCancel(a)}
                            style={styles.flex}
                          />
                        </View>
                      ) : null}

                      {isActive && a.status === 'confirmed' && !canReschedule ? (
                        <Text style={styles.lockNote}>
                          This session starts within 24 hours — contact the Guidance Office if
                          you need to move it.
                        </Text>
                      ) : null}

                      {isActive && a.status === 'confirmed' ? (
                        <View style={styles.mt}>
                          <Button label="Message" onPress={() => router.push('/chat')} />
                        </View>
                      ) : null}

                      {isActive && a.mode === 'online' && a.meeting_url ? (
                        <Text style={styles.meet}>Video link is ready in your confirmation.</Text>
                      ) : null}

                      {a.status === 'completed' ? (
                        <View style={styles.rate}>
                          {sent !== undefined ? (
                            <Text style={styles.rateLabel}>You rated this session {sent}★</Text>
                          ) : (
                            <>
                              <Text style={styles.rateLabel}>Rate this session</Text>
                              <StarRating
                                value={draft[a.id] ?? 0}
                                onChange={(v) => setDraft((d) => ({ ...d, [a.id]: v }))}
                              />
                              <View style={styles.mt}>
                                <Button
                                  label={fbBusyId === a.id ? 'Sending…' : 'Send'}
                                  disabled={!draft[a.id] || fbBusyId !== null}
                                  onPress={() => void sendFeedback(a)}
                                />
                              </View>
                            </>
                          )}
                        </View>
                      ) : null}
                    </Card>
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      <SessionDetailsModal
        appointment={selected}
        cancelTarget={cancelTarget}
        counselorName={
          selected?.counselor_id ? counselorNames[selected.counselor_id] : undefined
        }
        counselorSpecialty={selectedSpecialty}
        onClose={() => setOpenId(null)}
        onRequestReschedule={requestReschedule}
        onRequestCancel={requestCancel}
        onCancelClose={() => setCancelTarget(null)}
        onCancelled={applyCancelled}
      />

      <RescheduleModal
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={applyRescheduled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 96, gap: spacing.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center' },
  statBlue: { backgroundColor: colors.blue, borderBottomColor: colors.blueDark },
  statN: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  statL: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  statNLight: { color: colors.white },
  statLLight: { color: colors.white },
  tabs: { flexDirection: 'row', gap: spacing.md },
  tabWrap: { borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.muted,
    paddingVertical: spacing.sm,
  },
  tabTextOn: { fontFamily: fontFamily.bold, color: colors.blue },
  row: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 40, alignItems: 'center' },
  month: { fontFamily: fontFamily.bold, fontSize: fontSize.xxs, color: colors.muted },
  dayNum: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  dot: { width: spacing.sm, height: spacing.sm, borderRadius: 4, marginTop: spacing.xs },
  line: { width: 2, flex: 1, backgroundColor: colors.creamLine, marginTop: spacing.xs },
  card: { flex: 1 },
  cardPress: { flex: 1 },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  meta: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  lockNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  checkinOk: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.blue,
    marginTop: spacing.sm,
  },
  checkinNeeded: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  mt: { marginTop: spacing.sm },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
  rate: { marginTop: spacing.sm, gap: spacing.sm },
  rateLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
  meet: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.blue, marginTop: spacing.sm },
  emptyTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  emptySub: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  center: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  errCard: { borderWidth: 1, borderColor: colors.danger, gap: spacing.sm },
  errText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.danger },
});
