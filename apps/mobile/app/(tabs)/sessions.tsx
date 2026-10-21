import { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fontFamily, fontSize, radius, spacing, hitSlop } from '@/theme';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { StatusChip } from '@/components/StatusChip';
import { StarRating } from '@/components/StarRating';
import { appointments as seed, stats, type Appointment } from '@/data/mock';

type Tab = 'Upcoming' | 'Past' | 'Canceled';
const tabs: Tab[] = ['Upcoming', 'Past', 'Canceled'];

export default function Sessions() {
  const [upcoming, setUpcoming] = useState<Appointment[]>(seed.filter((a) => a.status !== 'Completed'));
  const [past] = useState<Appointment[]>(seed.filter((a) => a.status === 'Completed'));
  const [canceled, setCanceled] = useState<Appointment[]>([]);
  const [tab, setTab] = useState<Tab>('Upcoming');
  const [ratings, setRatings] = useState<Record<string, number>>({});

  const list = tab === 'Upcoming' ? upcoming : tab === 'Past' ? past : canceled;

  const cancel = (id: string) => {
    const item = upcoming.find((a) => a.id === id);
    if (!item) return;
    setUpcoming((u) => u.filter((a) => a.id !== id));
    setCanceled((c) => [...c, { ...item, status: 'Canceled' }]);
  };

  const dotColor = (s: Appointment['status']) =>
    s === 'Confirmed' ? colors.blue : s === 'Pending' ? colors.sun : colors.muted;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.head}>
            <Text style={styles.title}>My sessions</Text>
            <Button label="+ Book new" variant="accent" onPress={() => router.push('/book')} />
          </View>

          <View style={styles.stats}>
            <Card style={[styles.stat, styles.statBlue]}>
              <Text style={[styles.statN, styles.statNLight]}>{stats.upcoming}</Text>
              <Text style={[styles.statL, styles.statLLight]}>Upcoming</Text>
            </Card>
            <Card style={styles.stat}>
              <Text style={styles.statN}>{stats.completed}</Text>
              <Text style={styles.statL}>Completed</Text>
            </Card>
            <Card style={styles.stat}>
              <Text style={styles.statN}>{stats.checkins}</Text>
              <Text style={styles.statL}>Check-ins</Text>
            </Card>
          </View>

          <View style={styles.tabs}>
            {tabs.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                hitSlop={hitSlop}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t }}
                style={[styles.tab, tab === t && styles.tabOn]}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {list.length === 0 ? (
            <Card>
              <Text style={styles.emptyTitle}>
                {tab === 'Canceled' ? 'No canceled sessions' : 'No upcoming sessions'}
              </Text>
              <Text style={styles.emptySub}>
                {tab === 'Canceled'
                  ? 'Canceled sessions will show up here.'
                  : 'Book when you are ready. We are here.'}
              </Text>
              {tab !== 'Canceled' ? (
                <View style={styles.mt}>
                  <Button label="Book a session" onPress={() => router.push('/book')} />
                </View>
              ) : null}
            </Card>
          ) : (
            list.map((a) => (
              <View key={a.id} style={styles.row}>
                <View style={styles.rail}>
                  <Text style={styles.month}>{a.month}</Text>
                  <Text style={styles.dayNum}>{a.day}</Text>
                  <View style={[styles.dot, { backgroundColor: dotColor(a.status) }]} />
                  <View style={styles.line} />
                </View>
                <Card style={styles.card}>
                  <Text style={styles.cardTitle}>{a.title}</Text>
                  <Text style={styles.meta}>
                    {a.weekday} · {a.time} · {a.mode} · {a.location}
                  </Text>
                  <View style={styles.mt}>
                    <StatusChip status={a.status} />
                  </View>
                  {a.status === 'Completed' ? (
                    <View style={styles.rate}>
                      <Text style={styles.rateLabel}>Rate this session</Text>
                      <StarRating
                        value={ratings[a.id] ?? 0}
                        onChange={(v) => setRatings((r) => ({ ...r, [a.id]: v }))}
                      />
                      <View style={styles.mt}>
                        <Button label="Send" onPress={() => undefined} />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.btns}>
                      <Button label="Reschedule" variant="outline" onPress={() => router.push('/book')} style={styles.flex} />
                      <Button label="Cancel" variant="outline" onPress={() => cancel(a.id)} style={styles.flex} />
                      {a.status === 'Confirmed' ? (
                        <Button label="Message" onPress={() => router.push('/chat')} style={styles.flex} />
                      ) : null}
                    </View>
                  )}
                </Card>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
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
  tab: { paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.blue },
  tabText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.muted },
  tabTextOn: { fontFamily: fontFamily.bold, color: colors.blue },
  row: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 40, alignItems: 'center' },
  month: { fontFamily: fontFamily.bold, fontSize: fontSize.xxs, color: colors.muted },
  dayNum: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  dot: { width: spacing.sm, height: spacing.sm, borderRadius: 4, marginTop: spacing.xs },
  line: { width: 2, flex: 1, backgroundColor: colors.creamLine, marginTop: spacing.xs },
  card: { flex: 1 },
  cardTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  meta: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  mt: { marginTop: spacing.sm },
  btns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
  rate: { marginTop: spacing.sm, gap: spacing.sm },
  rateLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
  emptyTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  emptySub: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
});
