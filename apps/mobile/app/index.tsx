import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Check from 'lucide-react-native/icons/check';
import { colors, fontFamily, fontSize, spacing, sizes, hitSlop } from '@/theme';
import { Button } from '@/components/Button';
import { Mascot } from '@/components/mascot/Lumi';
import { useMascot } from '@/components/mascot/useMascot';

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
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<Page> | null>(null);
  const lumi = useMascot('happy');
  const { width } = useWindowDimensions();
  const last = index === pages.length - 1;

  const goLogin = () => router.push('/login');
  const goNext = () => {
    if (last) return;
    list.current?.scrollToIndex({ index: index + 1, animated: true });
  };
  const goBack = () => {
    if (index === 0) return;
    list.current?.scrollToIndex({ index: index - 1, animated: true });
  };

  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]?.index;
    if (first !== undefined && first !== null) setIndex(first);
  }, []);

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
            <Button label="Log in" variant="accent" onPress={goLogin} style={styles.btn} />
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
