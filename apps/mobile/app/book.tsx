import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Video from 'lucide-react-native/icons/video';
import Building2 from 'lucide-react-native/icons/building-complex';
import { bookableDays, bookableSlots, type AvailabilityWindow, type BookableSlot } from '@dorsu/shared-services';
import { getSupabase } from '@/lib/supabase/client';
import { colors, fontFamily, fontSize, radius, cardRadius, spacing, sizes, hitSlop } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TabBar, TAB_BAR_BASE } from '@/components/TabBar';

const concerns = ['Academic', 'Personal', 'Financial', 'Social', 'Family', 'Other'] as const;
type Concern = (typeof concerns)[number];

const meetModes = [
  { id: 'inperson', title: 'In person', helper: 'Meet at the Guidance Office, Main Campus.' },
  { id: 'online', title: 'Online', helper: 'A video link is sent before your session.' },
] as const;
type MeetModeId = (typeof meetModes)[number]['id'];

const modeIcons = { inperson: Building2, online: Video } as const;

export default function Book() {
  const [concern, setConcern] = useState<Concern | null>(null);
  const [mode, setMode] = useState<MeetModeId>('inperson');
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<BookableSlot | null>(null);
  const [alias, setAlias] = useState(true);
  const [windows, setWindows] = useState<AvailabilityWindow[] | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const insets = useSafeAreaInsets();

  // Real counselor availability (RLS lets any signed-in user read it). The
  // resulting slots are booking *requests* — the head still assigns/confirms.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('counselor_availability')
          .select('weekday, start_time, end_time, is_recurring, valid_from, valid_to')
          .limit(500);
        if (!alive) return;
        if (error) throw error;
        setWindows((data ?? []) as AvailabilityWindow[]);
      } catch (e) {
        if (!alive) return;
        setAvailabilityError(
          e instanceof Error ? e.message : 'Could not load availability. Please try again.',
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const days = useMemo(() => (windows ? bookableDays(windows, new Date(), 7) : []), [windows]);
  const times = useMemo(
    () => (windows && day ? bookableSlots(windows, day, new Date()) : []),
    [windows, day],
  );

  const modeHelper = meetModes.find((m) => m.id === mode)?.helper ?? '';
  const ready = concern !== null && day !== null && slot !== null;
  const dayLabel = day ? days.find((d) => d.date === day) : undefined;
  const summary =
    ready && dayLabel && slot
      ? `${concern} · ${dayLabel.weekdayShort} ${dayLabel.dayOfMonth} · ${slot.label}`
      : 'Pick a concern, day and time.';

  const pickDay = (date: string) => {
    setDay(date);
    // A time is only valid for the day it was generated from.
    setSlot(null);
  };

  const goCheckIn = () => {
    if (!ready || !concern || !day || !slot) return;
    router.push({
      pathname: '/check-in',
      params: {
        concern,
        mode,
        date: day,
        time: slot.label,
        start: slot.startIso,
        alias: alias ? '1' : '0',
      },
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
            {availabilityError !== '' ? (
              <View style={styles.availabilityErr}>
                <Text style={styles.availabilityErrText}>{availabilityError}</Text>
                <Button
                  label="Try again"
                  variant="outline"
                  onPress={() => {
                    setWindows(null);
                    setAvailabilityError('');
                    setReloadKey((k) => k + 1);
                  }}
                />
              </View>
            ) : windows === null ? (
              <Text style={styles.helper}>Loading availability…</Text>
            ) : days.length === 0 ? (
              <Text style={styles.helper}>
                No availability posted yet. Please check back later or contact the Guidance Office.
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.days}
              >
                {days.map((d) => {
                  const selected = day === d.date;
                  return (
                    <Pressable
                      key={d.date}
                      onPress={() => pickDay(d.date)}
                      hitSlop={hitSlop}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      style={[styles.day, selected && styles.dayOn]}
                    >
                      <Text style={[styles.dayW, selected && styles.dayTextOn]}>
                        {d.weekdayShort}
                      </Text>
                      <Text style={[styles.dayN, selected && styles.dayTextOn]}>{d.dayOfMonth}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </Card>

          <Card>
            <Text style={styles.h}>Available times</Text>
            {day === null ? (
              <Text style={styles.helper}>Pick a day to see open times.</Text>
            ) : times.length === 0 ? (
              <Text style={styles.helper}>No open times on this day. Try another day.</Text>
            ) : (
              <View style={styles.times}>
                {times.map((t) => (
                  <Chip
                    key={t.startIso}
                    label={t.label}
                    selected={slot?.startIso === t.startIso}
                    selectedTone="yellow"
                    onPress={() => setSlot(t)}
                    style={styles.timeChip}
                  />
                ))}
              </View>
            )}
            <Text style={styles.helper}>Sessions last about 60 minutes.</Text>
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
  availabilityErr: { gap: spacing.sm },
  availabilityErrText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.danger },
  days: { flexDirection: 'row', gap: spacing.sm },
  day: {
    width: 54,
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
