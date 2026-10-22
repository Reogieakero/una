import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
import Bell from 'lucide-react-native/icons/bell';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import Clock from 'lucide-react-native/icons/clock';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  cardRadius,
  spacing,
  sizes,
  hitSlop,
  cardShadow,
} from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { CounselorPill } from '@/components/CounselorPill';
import { RescheduleModal } from '@/components/RescheduleModal';
import { SessionDetailsModal } from '@/components/SessionDetailsModal';
import { StatusChip } from '@/components/StatusChip';
import { MoodPicker, type MoodId } from '@/components/MoodPicker';
import { LumiFigure } from '@/components/mascot/Lumi';
import { getSupabase } from '@/lib/supabase/client';
import { loadCounselorDirectory } from '@/lib/counselors';
import type { AppointmentRow } from '@dorsu/shared-types';
import { listStudentAppointments } from '@dorsu/shared-services';
import { useNotificationCount } from '@/lib/notifications-context';

const quick = [
  { id: 'book', title: 'Book a session', sub: 'Face-to-face, phone, online', Icon: CalendarDays, href: '/book' },
  { id: 'talk', title: 'Talk to us', sub: 'Anonymous chat', Icon: MessageCircle, href: '/chat' },
  { id: 'stress', title: 'Stress check', sub: '2-minute PSS check', Icon: ClipboardList, href: '/check-in' },
  { id: 'mine', title: 'My sessions', sub: 'Upcoming and past', Icon: Clock, href: '/(tabs)/sessions' },
] as const;

interface Announcement {
  id: string;
  title: string;
  body: string | null;
  published_at: string | null;
}

const ACTIVE_STATUSES = ['pending', 'assigned', 'confirmed'];

/** Lumi's spoken script — one line per 4-second breath phase, loops. */
const BREATH_SCRIPT = [
  'Breathe in… nice and slow.',
  'Breathe out… let it all go.',
  'Breathe in… feel your chest rise.',
  'Breathe out… drop your shoulders.',
  'Breathe in… fresh, calm air.',
  'Breathe out… worries drift away.',
  'Almost there… one more slow breath.',
  'And release… well done.',
] as const;

/**
 * Voice sync for breath-guide.mp3 (25.9s). Each entry is one script line:
 * `at` = start second, `len` = play seconds. Cut points were measured
 * from the recording's own pauses — every cut lands mid-silence with
 * 0.25s+ margin, and playback stops at the line end so the next line's
 * first word never leaks into the current message. Nudge a value if a
 * line ever sounds early/late against its message.
 */
const BREATH_LINES = [
  { at: 0, len: 2.94 }, // Breathe in… nice and slow.
  { at: 2.99, len: 3.39 }, // Breathe out… let it all go.
  { at: 6.43, len: 3.59 }, // Breathe in… feel your chest rise.
  { at: 10.07, len: 2.83 }, // Breathe out… drop your shoulders.
  { at: 12.95, len: 3.51 }, // Breathe in… fresh, calm air.
  { at: 16.51, len: 3.15 }, // Breathe out… worries drift away.
  { at: 19.71, len: 3.27 }, // Almost there… one more slow breath.
  { at: 23.03, len: 2.81 }, // And release… well done.
] as const;

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${weekday}, ${monthDay} · ${h}:${m} ${ampm}`;
}

function formatBadge(iso: string): { month: string; day: string } {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
  };
}

export default function Home() {
  const [mood, setMood] = useState<MoodId | null>('okay');
  const [firstName, setFirstName] = useState('Student');
  const [greeting, setGreeting] = useState(() => greetingForHour(new Date().getHours()));
  const [next, setNext] = useState<AppointmentRow | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const { unread, refresh: refreshUnread } = useNotificationCount();
  const [counselorNames, setCounselorNames] = useState<Record<string, string>>({});
  const [counselorSpecialties, setCounselorSpecialties] = useState<Record<string, string>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<AppointmentRow | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRow | null>(null);
  const [breathOpen, setBreathOpen] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [scriptStep, setScriptStep] = useState(0);
  const scale = useRef(new Animated.Value(0.6)).current;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guidePlayer = useAudioPlayer(require('@/assets/audio/breath-guide.mp3'));

  const load = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setGreeting(greetingForHour(new Date().getHours()));

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      const fullName = (profile?.full_name ?? '').trim();
      if (fullName !== '') {
        const first = fullName.split(/\s+/)[0] ?? fullName;
        setFirstName(first);
      }

      const { data: student } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (student) {
        const rows = (await listStudentAppointments(
          supabase,
          student.id,
        )) as AppointmentRow[];
        const upcoming = rows
          .filter(
            (a) =>
              ACTIVE_STATUSES.includes(a.status) &&
              new Date(a.scheduled_at).getTime() > Date.now(),
          )
          .sort(
            (a, b) =>
              new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
          )[0];
        setNext(upcoming ?? null);
        const directory = await loadCounselorDirectory(supabase);
        setCounselorNames(directory.names);
        setCounselorSpecialties(directory.specialties);
      }

      const { data: anns } = await supabase
        .from('announcements')
        .select('id, title, body, published_at')
        .lte('published_at', new Date().toISOString())
        .order('published_at', { ascending: false })
        .limit(3);
      setAnnouncements((anns ?? []) as Announcement[]);
    } catch {
      // Keep last-known (or empty) state on network failure.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      void refreshUnread();
    }, [load, refreshUnread]),
  );

  const stopBreath = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (lineTimer.current) clearTimeout(lineTimer.current);
    lineTimer.current = null;
    guidePlayer.pause();
    guidePlayer.seekTo(0);
    setBreathOpen(false);
    setSeconds(60);
    setScriptStep(0);
    scale.setValue(0.6);
  };

  // Voice follows the message: every time the displayed line changes,
  // jump the recording to that line's timestamp, play exactly that line,
  // then pause so the next line never bleeds in early.
  useEffect(() => {
    if (!breathOpen) return;
    const line = BREATH_LINES[scriptStep % BREATH_LINES.length] ?? BREATH_LINES[0];
    if (!line) return;
    try {
      if (lineTimer.current) clearTimeout(lineTimer.current);
      guidePlayer.seekTo(line.at);
      guidePlayer.play();
      lineTimer.current = setTimeout(() => {
        guidePlayer.pause();
      }, Math.max(500, line.len * 1000));
    } catch {
      // Player not ready yet — the next line change retries.
    }
    return () => {
      if (lineTimer.current) {
        clearTimeout(lineTimer.current);
        lineTimer.current = null;
      }
    };
  }, [breathOpen, scriptStep, guidePlayer]);

  const startBreath = () => {
    setBreathOpen(true);
    setSeconds(60);
    setScriptStep(0);
    const loop = (inhale: boolean, step: number) => {
      setScriptStep(step);
      Animated.timing(scale, {
        toValue: inhale ? 1 : 0.6,
        duration: 4000,
        useNativeDriver: true,
      }).start(() => {
        if (timer.current) loop(!inhale, step + 1);
      });
    };
    loop(true, 0);
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          guidePlayer.pause();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const modeLabel = next?.mode === 'online' ? 'Online' : 'Face-to-face';
  const nextMeta =
    next?.mode === 'online' ? `${modeLabel} · Video link` : `${modeLabel} · Guidance Office`;
  const canRescheduleNext =
    next !== null && (next.status === 'pending' || next.status === 'assigned');

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={styles.hello}>
              <Text style={styles.good}>{greeting}</Text>
              <Text style={styles.name}>{firstName}</Text>
            </View>
            <View>
              <Pressable
                onPress={() => router.push('/notifications')}
                hitSlop={hitSlop}
                accessibilityRole="button"
                accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                style={styles.bell}
              >
                <Bell size={sizes.tabIcon} color={colors.ink} />
              </Pressable>
              {unread > 0 ? (
                <View style={styles.bellBadge} pointerEvents="none">
                  <Text style={styles.bellBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <Card>
            <Text style={styles.cardTitle}>How are you feeling today?</Text>
            <Text style={styles.cardSub}>Only you can see this</Text>
            <View style={styles.moodWrap}>
              <MoodPicker value={mood} onChange={setMood} />
            </View>
          </Card>

          <View style={styles.breath}>
            <View style={styles.rings}>
              <View style={styles.ringOuter}>
                <View style={styles.ringInner} />
              </View>
            </View>
            <View style={styles.breathText}>
              <Text style={styles.cardTitle}>1-minute breathing</Text>
              <Text style={styles.cardSub}>Calm your mind before class.</Text>
            </View>
            <Button label="Start" variant="dark" onPress={startBreath} />
          </View>

          {next ? (
            <Pressable
              onPress={() => setDetailsOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Open next session details"
              style={styles.next}
            >
              <View style={styles.nextSun} pointerEvents="none" />
              <Text style={styles.nextEyebrow}>NEXT SESSION</Text>
              <Text style={styles.nextWhen}>{formatWhen(next.scheduled_at)}</Text>
              <Text style={styles.nextMeta}>{nextMeta}</Text>
              <View style={styles.nextPills}>
                <StatusChip status={next.status} />
                <CounselorPill
                  assigned={next.counselor_id !== null}
                  name={
                    next.counselor_id ? counselorNames[next.counselor_id] : undefined
                  }
                />
              </View>
              <View style={styles.nextBtns}>
                {canRescheduleNext ? (
                  <Button
                    label="Reschedule"
                    variant="outline"
                    onPress={() => {
                      setDetailsOpen(false);
                      setRescheduleTarget(next);
                    }}
                    style={styles.flex}
                  />
                ) : null}
                <Button
                  label="Cancel"
                  variant="dangerOutline"
                  onPress={() => {
                    setDetailsOpen(false);
                    setCancelTarget(next);
                  }}
                  style={styles.flex}
                />
              </View>
              {next.status === 'confirmed' ? (
                <Text style={styles.nextNote}>
                  Confirmed by your counselor — rescheduling is closed.
                </Text>
              ) : null}
            </Pressable>
          ) : (
            <Card>
              <Text style={styles.cardTitle}>No upcoming sessions</Text>
              <Text style={styles.cardSub}>Book when you are ready. We are here.</Text>
              <View style={styles.mt}>
                <Button label="Book a session" onPress={() => router.push('/book')} />
              </View>
            </Card>
          )}

          <View style={styles.grid}>
            {quick.map(({ id, title, sub, Icon, href }) => (
              <Pressable
                key={id}
                onPress={() => router.push(href)}
                hitSlop={hitSlop}
                accessibilityRole="button"
                accessibilityLabel={title}
                style={styles.tile}
              >
                <View style={styles.tileIcon}>
                  <Icon size={sizes.tabIcon} color={colors.blue} />
                </View>
                <Text style={styles.tileTitle}>{title}</Text>
                <Text style={styles.tileSub}>{sub}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.eventsHead}>
            <Text style={styles.cardTitle}>Announcement</Text>
            <Pressable hitSlop={hitSlop} accessibilityRole="button" onPress={() => undefined}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          {announcements.length === 0 ? (
            <Card>
              <Text style={styles.cardTitle}>No announcements yet</Text>
              <Text style={styles.cardSub}>New events from the Guidance Office will show up here.</Text>
            </Card>
          ) : (
            announcements.map((e) => {
              const badge = e.published_at ? formatBadge(e.published_at) : { month: '', day: '' };
              return (
                <Card key={e.id}>
                  <View style={styles.eventRow}>
                    <View style={styles.date}>
                      <Text style={styles.dateM}>{badge.month}</Text>
                      <Text style={styles.dateD}>{badge.day}</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.eventTitle}>{e.title}</Text>
                      {e.body ? (
                        <Text style={styles.cardSub} numberOfLines={2}>
                          {e.body}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      <SessionDetailsModal
        appointment={detailsOpen ? next : null}
        cancelTarget={cancelTarget}
        counselorName={next?.counselor_id ? counselorNames[next.counselor_id] : undefined}
        counselorSpecialty={
          next?.counselor_id ? counselorSpecialties[next.counselor_id] : undefined
        }
        onClose={() => setDetailsOpen(false)}
        onRequestReschedule={(appointment) => {
          setDetailsOpen(false);
          setRescheduleTarget(appointment);
        }}
        onRequestCancel={(appointment) => {
          setDetailsOpen(false);
          setCancelTarget(appointment);
        }}
        onCancelClose={() => setCancelTarget(null)}
        onCancelled={(appointment) =>
          setNext((cur) => (cur?.id === appointment.id ? null : cur))
        }
      />

      <RescheduleModal
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onRescheduled={(updated) =>
          setNext((cur) => (cur?.id === updated.id ? updated : cur))
        }
      />

      <Modal visible={breathOpen} transparent animationType="fade" onRequestClose={stopBreath}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Animated.View style={{ transform: [{ scale }] }}>
              <LumiFigure look={4} feel="calm" size={120} />
            </Animated.View>
            <Text numberOfLines={2} style={styles.phaseText}>
              {BREATH_SCRIPT[scriptStep % BREATH_SCRIPT.length]}
            </Text>
            <Text style={styles.cardSub}>Follow Lumi — breathe in as it grows, out as it shrinks.</Text>
            <Text style={styles.breathCount}>{seconds}s</Text>
            <Button label="Stop" variant="dark" onPress={stopBreath} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 96, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bell: { padding: spacing.xs },
  hello: { flex: 1 },
  good: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  name: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: colors.white, fontSize: fontSize.xxs, fontWeight: '700' },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  cardSub: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  moodWrap: { marginTop: spacing.sm },
  next: {
    backgroundColor: colors.blue,
    borderRadius: cardRadius,
    padding: spacing.md,
    overflow: 'hidden',
    gap: spacing.xs,
  },
  nextSun: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.sun,
    opacity: 0.9,
  },
  nextEyebrow: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, color: colors.white },
  nextWhen: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.white },
  nextMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.white },
  nextPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  nextNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.white,
    opacity: 0.9,
  },
  nextBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
  mt: { marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: cardRadius,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.creamLine,
    gap: spacing.xs,
    ...cardShadow,
  },
  tileIcon: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radius,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
  tileSub: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  breath: {
    backgroundColor: colors.sunSoft,
    borderRadius: cardRadius,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rings: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  ringOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.sun },
  breathText: { flex: 1 },
  eventsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.blue },
  eventRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  date: {
    backgroundColor: colors.sun,
    borderRadius: radius,
    padding: spacing.sm,
    alignItems: 'center',
    minWidth: 48,
  },
  dateM: { fontFamily: fontFamily.bold, fontSize: fontSize.xxs, color: colors.ink },
  dateD: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  eventTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.ink },
  modalBg: { flex: 1, backgroundColor: 'rgba(20,49,92,0.5)', justifyContent: 'center', padding: spacing.lg },
  modal: { backgroundColor: colors.white, borderRadius: cardRadius, padding: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  phaseText: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink, textAlign: 'center', lineHeight: 24, minHeight: 48 },
  breathCount: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
});
