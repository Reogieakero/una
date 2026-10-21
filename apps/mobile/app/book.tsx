import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Video from 'lucide-react-native/icons/video';
import Building2 from 'lucide-react-native/icons/building-complex';
import { colors, fontFamily, fontSize, radius, cardRadius, spacing, sizes, hitSlop } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TabBar, TAB_BAR_BASE } from '@/components/TabBar';

const concerns = ['Academic', 'Personal', 'Financial', 'Social', 'Family', 'Other'] as const;
type Concern = (typeof concerns)[number];

const meetModes = [
  { id: 'inperson', title: 'In person', helper: 'Meet at the Guidance Office, Main Campus.' },
  { id: 'online', title: 'Online', helper: 'Video link is sent before your session.' },
] as const;
type MeetModeId = (typeof meetModes)[number]['id'];

const modeIcons = { inperson: Building2, online: Video } as const;

const timeSlots = [
  { id: 't1', label: '9:00 AM', disabled: false },
  { id: 't2', label: '10:30 AM', disabled: false },
  { id: 't3', label: '1:00 PM', disabled: true },
  { id: 't4', label: '2:00 PM', disabled: false },
  { id: 't5', label: '3:30 PM', disabled: false },
  { id: 't6', label: '4:30 PM', disabled: false },
] as const;

interface SchoolDay {
  id: string;
  weekday: string;
  day: string;
}

/** Next school days (Mon–Fri) from tomorrow — real dates, backend-ready ISO ids. */
function nextSchoolDays(count: number): SchoolDay[] {
  const out: SchoolDay[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (out.length < count) {
    const wd = d.getDay();
    if (wd >= 1 && wd <= 5) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`;
      out.push({
        id: iso,
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
        day: String(d.getDate()),
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function Book() {
  const [concern, setConcern] = useState<Concern | null>(null);
  const [mode, setMode] = useState<MeetModeId>('inperson');
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [alias, setAlias] = useState(true);
  const insets = useSafeAreaInsets();
  const days = useMemo(() => nextSchoolDays(5), []);

  const modeHelper = meetModes.find((m) => m.id === mode)?.helper ?? '';
  const ready = concern !== null && day !== null && time !== null;
  const dayLabel = day ? days.find((d) => d.id === day) : undefined;
  const summary =
    ready && dayLabel
      ? `${concern} · ${dayLabel.weekday} ${dayLabel.day} · ${time}`
      : 'Pick a concern, day and time.';

  const goCheckIn = () => {
    if (!ready || !concern || !day || !time) return;
    router.push({
      pathname: '/check-in',
      params: { concern, mode, date: day, time, alias: alias ? '1' : '0' },
    });
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Book a session</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Step 1 of 2</Text>
          </View>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Card>
            <Text style={styles.h}>What&apos;s on your mind?</Text>
            <View style={styles.chips}>
              {concerns.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={concern === c}
                  selectedTone="blue"
                  onPress={() => setConcern(c)}
                />
              ))}
            </View>
          </Card>

          <Card>
            <Text style={styles.h}>How would you like to meet?</Text>
            <View style={styles.modes}>
              {meetModes.map((m) => {
                const Icon = modeIcons[m.id];
                const selected = mode === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setMode(m.id)}
                    hitSlop={hitSlop}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[styles.mode, selected && styles.modeOn]}
                  >
                    <Icon size={sizes.tabIcon} color={selected ? colors.ink : colors.muted} />
                    <Text style={[styles.modeText, selected && styles.modeTextOn]}>{m.title}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.helper}>{modeHelper}</Text>
          </Card>

          <Card>
            <Text style={styles.h}>Choose a day</Text>
            <View style={styles.days}>
              {days.map((d) => {
                const selected = day === d.id;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => setDay(d.id)}
                    hitSlop={hitSlop}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    style={[styles.day, selected && styles.dayOn]}
                  >
                    <Text style={[styles.dayW, selected && styles.dayTextOn]}>{d.weekday}</Text>
                    <Text style={[styles.dayN, selected && styles.dayTextOn]}>{d.day}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <Card>
            <Text style={styles.h}>Available times</Text>
            <View style={styles.times}>
              {timeSlots.map((t) => (
                <Chip
                  key={t.id}
                  label={t.label}
                  disabled={t.disabled}
                  selected={time === t.label}
                  selectedTone="yellow"
                  onPress={() => setTime(t.label)}
                  style={styles.timeChip}
                />
              ))}
            </View>
          </Card>

          <View style={styles.alias}>
            <Text style={styles.aliasText}>Book under my alias</Text>
            <Switch
              value={alias}
              onValueChange={setAlias}
              accessibilityRole="switch"
              accessibilityState={{ checked: alias }}
              trackColor={{ true: colors.sun, false: colors.border }}
              thumbColor={colors.white}
            />
          </View>
        </ScrollView>
        <View style={[styles.bar, { marginBottom: insets.bottom + TAB_BAR_BASE }]}>
          <Text style={styles.summary} numberOfLines={1}>
            Your selection: {summary}
          </Text>
          <Button
            label="Continue"
            disabled={!ready}
            onPress={goCheckIn}
            style={styles.continue}
          />
        </View>
      </SafeAreaView>
      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  safe: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink, flex: 1 },
  pill: { backgroundColor: colors.sky, borderRadius: radius, paddingHorizontal: spacing.sm, height: sizes.buttonHeight, justifyContent: 'center' },
  pillText: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, color: colors.ink },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md },
  h: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  modes: { flexDirection: 'row', gap: spacing.sm },
  mode: {
    flex: 1,
    borderRadius: radius,
    backgroundColor: colors.chip,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeOn: { borderWidth: 2, borderColor: colors.sun, backgroundColor: colors.cream },
  modeText: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: colors.muted },
  modeTextOn: { fontFamily: fontFamily.bold, color: colors.ink },
  helper: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted, marginTop: spacing.sm },
  days: { flexDirection: 'row', gap: spacing.sm },
  day: {
    flex: 1,
    borderRadius: radius,
    backgroundColor: colors.chip,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  dayOn: { backgroundColor: colors.blue },
  dayW: { fontFamily: fontFamily.medium, fontSize: fontSize.xs, color: colors.muted },
  dayN: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  dayTextOn: { color: colors.white },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeChip: { flexGrow: 1, minWidth: '30%' },
  alias: {
    backgroundColor: colors.sunSoft,
    borderRadius: cardRadius,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aliasText: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
  bar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.creamLine,
    padding: spacing.md,
    gap: spacing.sm,
  },
  summary: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  continue: { alignSelf: 'stretch' },
});
