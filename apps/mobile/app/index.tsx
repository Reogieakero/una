import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type ListViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import { colors, fontFamily, fontSize, spacing, sizes, hitSlop } from '@/theme';
import { Button } from '@/components/Button';
import { Mascot } from '@/components/mascot/Lumi';
import { useMascot } from '@/components/mascot/useMascot';
import { getSupabase } from '@/lib/supabase/client';
import { hasSeenOnboarding, markOnboardingSeen } from '@/lib/onboarding';

interface Page {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  points: readonly string[];
}

const pages: Page[] = [
  {
    key: 'chat',
    eyebrow: 'ANONYMOUS CHAT',
    title: "You don't have to carry it alone.",
    body: 'Talk to the Guidance Office in a safe, private space made for DOrSU students.',
    points: ['Chat under an alias, never your real name', 'A counselor replies within the day', 'Free for every DOrSU student'],
  },
  {
    key: 'book',
    eyebrow: 'BOOK A SESSION',
    title: 'Time that fits your school day.',
    body: 'Pick a day and a way to meet that works around your classes.',
    points: ['Face-to-face, phone call or online', 'Same-week slots, Mon to Fri', 'Reschedule or cancel anytime'],
  },
  {
    key: 'checkin',
    eyebrow: 'STRESS CHECK-INS',
    title: 'Notice how you are doing.',
    body: 'A private 2-minute check-in helps your counselor prepare for you.',
    points: ['10 short questions, about 2 minutes', 'Only your counselor sees answers', 'No scores or labels shown to you'],
  },
];

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

export default function Onboarding() {
  const params = useLocalSearchParams<{ replay?: string }>();
  const replay = params.replay === '1';

  // `app/index` is the start route, so it doubles as the launch gate: an
  // existing session goes to Home, a returning visitor goes to Login, and
  // only a genuinely new student sees the welcome carousel. Profile can
  // still force it open with `?replay=1`.
  const [showOnboarding, setShowOnboarding] = useState(replay);

  useEffect(() => {
    // Replay is only reachable from Profile, which pushes a fresh screen, so
    // the initial state already shows the carousel — no gate check needed.
    if (replay) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      if (cancelled) return;
      if (session) {
        await markOnboardingSeen();
        if (!cancelled) router.replace('/(tabs)/home');
        return;
      }
      if (await hasSeenOnboarding()) {
        if (!cancelled) router.replace('/login');
        return;
      }
      if (!cancelled) setShowOnboarding(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [replay]);

  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<Page> | null>(null);
  const lumi = useMascot('happy');
  const { width } = useWindowDimensions();
  const last = index === pages.length - 1;

  const goLogin = async () => {
    await markOnboardingSeen();
    router.replace('/login');
  };

  // Replaying from Profile means the student is already signed in; "Log in"
  // would be wrong there, so the last page simply closes the carousel.
  const closeReplay = async () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    const {
      data: { session },
    } = await getSupabase().auth.getSession();
    router.replace(session ? '/(tabs)/home' : '/login');
  };

  const goNext = () => {
    if (last) return;
    list.current?.scrollToIndex({ index: index + 1, animated: true });
  };
  const goBack = () => {
    if (index === 0) return;
    list.current?.scrollToIndex({ index: index - 1, animated: true });
  };

  const onViewable = useCallback(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const first = viewableItems[0]?.index;
    if (first !== undefined && first !== null) setIndex(first);
  }, []);

  if (!showOnboarding) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root} {...lumi.gaze}>
      <View style={styles.mascot}>
        <Mascot controller={lumi} size={120} />
        <Text style={styles.tapme}>Tap me!</Text>
      </View>
      <FlatList
        ref={list}
        data={pages}
        keyExtractor={(p) => p.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={VIEWABILITY}
        renderItem={({ item }) => (
          <View style={[styles.page, { width }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.copy}>
              <Text style={styles.eyebrow}>{item.eyebrow}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              {item.points.map((pt) => (
                <View key={pt} style={styles.bullet}>
                  <Check size={sizes.tabIcon} strokeWidth={2} color={colors.blue} />
                  <Text style={styles.bulletText}>{pt}</Text>
                </View>
              ))}
              <View style={styles.dots}>
                {pages.map((p, i) => (
                  <View key={p.key} style={[styles.dot, i === index && styles.dotActive]} />
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      />

      <View style={styles.footer}>
        {last ? (
          <View style={styles.buttons}>
            <Pressable
              onPress={goBack}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Go back a page"
              style={styles.backLink}
            >
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <Button
              label={replay ? 'Done' : 'Log in'}
              variant="accent"
              onPress={() => void (replay ? closeReplay() : goLogin())}
              style={styles.btn}
            />
          </View>
        ) : (
          <View style={styles.buttons}>
            {index > 0 ? (
              <Pressable
                onPress={goBack}
                hitSlop={hitSlop}
                accessibilityRole="button"
                accessibilityLabel="Go back a page"
                style={styles.backLink}
              >
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            ) : null}
            <Button label="Next" variant="accent" onPress={goNext} style={styles.btn} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  mascot: { alignItems: 'center', paddingTop: spacing.md },
  tapme: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.blue, marginTop: spacing.xs },
  page: { flex: 1 },
  copy: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, gap: spacing.sm },
  eyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xs,
    color: colors.blue,
    letterSpacing: 1,
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.ink },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  bulletText: { flex: 1, flexShrink: 1, fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.ink },
  footer: { backgroundColor: colors.cream, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  dots: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  dot: { width: spacing.sm, height: spacing.sm, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: spacing.xl, backgroundColor: colors.sun },
  buttons: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  btn: { flex: 1 },
  backLink: { paddingHorizontal: spacing.sm, height: sizes.buttonHeight, justifyContent: 'center' },
  backText: { fontFamily: fontFamily.bold, fontSize: fontSize.sm, color: colors.ink },
});
