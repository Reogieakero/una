import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import X from 'lucide-react-native/icons/x';
import Meh from 'lucide-react-native/icons/face-neutral';
import { colors, fontFamily, fontSize, radius, cardRadius, spacing, sizes, hitSlop } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { ProgressSegments } from '@/components/ProgressSegments';
import { Chip } from '@/components/Chip';
import { SunCorner } from '@/components/illustrations/SunCorner';
import { pssQuestions, pssLabels } from '@/data/mock';
import { getSupabase } from '@/lib/supabase/client';
import { ensureStudentRows, friendlyDbError } from '@/lib/supabase/ensureStudent';
import { submitPss10, bookAppointment } from '@dorsu/shared-services';

function combineDateTime(dateIso: string, timeLabel: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  const t = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec(timeLabel.trim());
  if (!d || !t) return null;
  let h = parseInt(t[1] ?? '0', 10);
  const mer = (t[3] ?? '').toUpperCase();
  if (mer === 'PM' && h < 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), h, Number(t[2]));
}

export default function CheckIn() {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>(Array(pssQuestions.length).fill(-1));
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const params = useLocalSearchParams<{
    concern?: string;
    mode?: string;
    date?: string;
    time?: string;
    start?: string;
    alias?: string;
  }>();
  // With booking params this screen books a session after the PSS-10. Without
  // them ("Stress check" shortcut on Home) it only records the assessment.
  const bookingMode = Boolean(params.concern && params.mode && params.date && params.time);

  const current = answers[index] ?? -1;
  const last = index === pssQuestions.length - 1;

  const pick = (v: number) => {
    setAnswers((a) => a.map((x, i) => (i === index ? v : x)));
  };

  const finish = async () => {
    if (busy) return;
    setError('');
    if (answers.some((a) => a < 0)) {
      setError('Please answer every question first.');
      return;
    }
    const { concern, mode, date, time, alias, start } = params;
    // `start` is the exact UTC instant picked from real availability; fall
    // back to parsing the label for older links/params.
    const scheduledAt =
      start !== undefined
        ? new Date(start)
        : date && time
          ? combineDateTime(date, time)
          : null;
    if (bookingMode) {
      if (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
        setError('That time has passed. Go back and pick another.');
        return;
      }
    }
    setBusy(true);
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Please log in again to finish booking.');
        return;
      }
      let student: { id: string } | null = null;
      const first = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (first.error) {
        setError(friendlyDbError(first.error.message));
        return;
      }
      student = (first.data as { id: string } | null) ?? null;

      if (!student) {
        // Legacy accounts (registered while email confirmation blocked the
        // signup insert) can have a profile but no students row. Repair it
        // from auth metadata before failing the flow.
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const metaString = (key: string) =>
          typeof meta[key] === 'string' ? (meta[key] as string) : undefined;
        const ensured = await ensureStudentRows(supabase, user.id, {
          email: user.email ?? '',
          fullName: metaString('full_name') ?? '',
          studentNo: metaString('student_no'),
          program: metaString('program'),
          yearLevel: metaString('year_level'),
        });
        if (!ensured.ok) {
          setError(friendlyDbError(ensured.error));
          return;
        }
        const retry = await supabase
          .from('students')
          .select('id')
          .eq('profile_id', user.id)
          .maybeSingle();
        if (retry.error) {
          setError(friendlyDbError(retry.error.message));
          return;
        }
        student = (retry.data as { id: string } | null) ?? null;
      }

      if (!student) {
        setError('Account setup is incomplete. Please log in again.');
        return;
      }
      const pss = (await submitPss10(supabase, { studentId: student.id, answers })) as {
        id: string;
      };
      if (bookingMode && scheduledAt) {
        await bookAppointment(supabase, {
          studentId: student.id,
          scheduledAt,
          mode: mode === 'online' ? 'online' : 'in_person',
          concern: `${concern} support session requested`,
          isAnonymous: alias === '1',
          pss10Id: pss.id,
        });
      }
      setDone(true);
      setTimeout(() => router.replace(bookingMode ? '/chat' : '/(tabs)/home'), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
          <View style={styles.doneWrap}>
            <Card>
              <Text style={styles.q}>
                {bookingMode
                  ? 'Thanks, your counselor will see this before your session.'
                  : 'Thanks — your check-in was saved.'}
              </Text>
            </Card>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.sun} pointerEvents="none">
        <SunCorner size={160} />
      </View>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.header}>
          <IconButton label="Close check-in" onPress={() => router.back()}>
            <X size={sizes.tabIcon} color={colors.ink} />
          </IconButton>
          <Text style={styles.headerTitle}>Pre-session check-in</Text>
          <View style={styles.spacer} />
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            Question {index + 1} of {pssQuestions.length}
          </Text>
          <Text style={styles.metaText}>About 2 min left</Text>
        </View>
        <View style={styles.progress}>
          <ProgressSegments total={pssQuestions.length} current={index} />
        </View>

        <View style={styles.body}>
          <Card style={styles.qcard}>
            <View style={styles.face}>
              <Meh size={sizes.tabIcon} color={colors.blue} />
            </View>
            <Text style={styles.stem}>In the last month, how often have you…</Text>
            <Text style={styles.q}>{pssQuestions[index]}</Text>
            <View style={styles.row}>
              {[0, 1, 2, 3, 4].map((v) => {
                const on = current === v;
                return (
                  <Pressable
                    key={`a-${v}`}
                    onPress={() => pick(v)}
                    hitSlop={hitSlop}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={[styles.num, on && styles.numOn]}
                  >
                    <Text style={[styles.numText, on && styles.numTextOn]}>{v}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.ends}>
              <Text style={styles.endText}>Never</Text>
              <Text style={styles.endText}>Very often</Text>
            </View>
            {current >= 0 ? (
              <View style={styles.chipWrap}>
                <Chip label={pssLabels[current] ?? ''} selected selectedTone="yellow" />
              </View>
            ) : null}
          </Card>
          <View style={styles.privacy}>
            <Text style={styles.privacyText}>Private. Only your counselor sees this.</Text>
          </View>
        </View>

        {error !== '' ? (
          <View style={styles.errWrap}>
            <Text style={styles.err}>{error}</Text>
          </View>
        ) : null}
        <View style={styles.bar}>
          <Button
            label="Back"
            variant="outline"
            onPress={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0 || busy}
            style={styles.flex}
          />
          <Button
            label={
              busy
                ? bookingMode
                  ? 'Booking…'
                  : 'Submitting…'
                : last
                  ? 'Finish'
                  : 'Next question'
            }
            disabled={current < 0 || busy}
            onPress={() => {
              if (last) void finish();
              else setIndex((i) => i + 1);
            }}
            style={styles.flex}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  sun: { position: 'absolute', top: -50, left: -50, opacity: 0.7 },
  safe: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  headerTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink, flex: 1, textAlign: 'center' },
  spacer: { width: sizes.iconButton },
  meta: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  metaText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  progress: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  qcard: { alignItems: 'center', gap: spacing.sm },
  face: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radius,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stem: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted, textAlign: 'center' },
  q: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  num: {
    width: 48,
    height: 48,
    borderRadius: radius,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numOn: { backgroundColor: colors.sun },
  numText: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.muted },
  numTextOn: { color: colors.ink },
  ends: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  endText: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  chipWrap: { marginTop: spacing.xs },
  privacy: { backgroundColor: colors.sunSoft, borderRadius: cardRadius, padding: spacing.md },
  privacyText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.ink, textAlign: 'center' },
  bar: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.creamLine },
  errWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  err: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.danger },
  flex: { flex: 1 },
  doneWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
});
