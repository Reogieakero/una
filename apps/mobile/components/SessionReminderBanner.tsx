import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Clock from 'lucide-react-native/icons/clock';
import X from 'lucide-react-native/icons/x';
import { listStudentAppointments } from '@dorsu/shared-services';
import type { AppointmentRow } from '@dorsu/shared-types';
import { getSupabase } from '@/lib/supabase/client';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

/** Show the reminder once a confirmed session is within this window. */
const REMINDER_WINDOW_MS = 30 * 60_000;
/** Re-check every minute so the banner appears even if the student never navigates. */
const POLL_MS = 60_000;

type Reminder = {
  appointment: AppointmentRow;
  minutesLeft: number;
};

function reminderLabel(minutesLeft: number): string {
  if (minutesLeft <= 0) return 'Starting now';
  return `Starts in ${minutesLeft} min`;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * In-app session reminder, mounted in the root layout so it is visible on every
 * student screen. The app speaks to Supabase directly (no push service), so the
 * nearest confirmed appointment is polled once a minute and shown as a banner
 * when it is 30 minutes or less away.
 */
export function SessionReminderBanner() {
  const insets = useSafeAreaInsets();
  const [reminder, setReminder] = useState<Reminder | null>(null);
  // Keyed by id + scheduled_at so a rescheduled session can alert again.
  const dismissedRef = useRef<Set<string>>(new Set());
  const checkingRef = useRef(false);

  useEffect(() => {
    let alive = true;

    const check = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        const supabase = getSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!alive) return;
        if (!user) {
          setReminder(null);
          return;
        }
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();
        if (!alive) return;
        if (!student) {
          setReminder(null);
          return;
        }
        const rows = ((await listStudentAppointments(supabase, student.id)) ??
          []) as AppointmentRow[];
        if (!alive) return;

        const now = Date.now();
        let best: Reminder | null = null;
        for (const row of rows) {
          if (row.status !== 'confirmed') continue;
          const startsAt = new Date(row.scheduled_at).getTime();
          if (Number.isNaN(startsAt)) continue;
          const diff = startsAt - now;
          if (diff < 0 || diff > REMINDER_WINDOW_MS) continue;
          const key = `${row.id}:${row.scheduled_at}`;
          if (dismissedRef.current.has(key)) continue;
          const minutesLeft = Math.ceil(diff / 60_000);
          if (!best || startsAt < new Date(best.appointment.scheduled_at).getTime()) {
            best = { appointment: row, minutesLeft };
          }
        }
        setReminder(best);
      } catch {
        // Reminders are best-effort; never block the student's current screen.
      } finally {
        checkingRef.current = false;
      }
    };

    void check();
    const interval = setInterval(() => void check(), POLL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    const supabase = getSupabase();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void check();
    });

    return () => {
      alive = false;
      clearInterval(interval);
      appState.remove();
      subscription.unsubscribe();
    };
  }, []);

  if (!reminder) return null;

  const { appointment, minutesLeft } = reminder;
  const detail = appointment.mode === 'online' ? 'Online session' : 'In person · Guidance Office';

  return (
    <View
      style={[styles.wrap, { top: insets.top + spacing.sm }]}
      pointerEvents="box-none"
    >
      <View style={styles.banner}>
        <Pressable
          onPress={() => router.push('/(tabs)/sessions')}
          accessibilityRole="button"
          accessibilityLabel={`${reminderLabel(minutesLeft)}. ${detail}. Open my sessions.`}
          accessibilityLiveRegion="polite"
          style={styles.main}
        >
          <View style={styles.iconWrap}>
            <Clock size={18} color={colors.blue} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{reminderLabel(minutesLeft)}</Text>
            <Text style={styles.body} numberOfLines={1}>
              {timeLabel(appointment.scheduled_at)} · {detail}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => {
            dismissedRef.current.add(`${appointment.id}:${appointment.scheduled_at}`);
            setReminder(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss session reminder"
          hitSlop={8}
          style={styles.close}
        >
          <X size={16} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 100,
    elevation: 8,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.sky,
    backgroundColor: colors.surface,
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 1 },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.ink },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  close: { padding: spacing.xs },
});
