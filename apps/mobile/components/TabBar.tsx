import { View, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useSegments, type Href } from 'expo-router';
import Home from 'lucide-react-native/icons/house';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Clock from 'lucide-react-native/icons/clock';
import User from 'lucide-react-native/icons/user';
import type { LucideIcon } from 'lucide-react-native';
import { colors, cardRadius, spacing, hitSlop, sizes } from '@/theme';

// Only home, sessions and profile are real tabs.
// Book and Chat are root stack screens (app/book.tsx, app/chat.tsx), so they push.
const items: { key: string; label: string; Icon: LucideIcon; href: Href }[] = [
  { key: 'home', label: 'Home', Icon: Home, href: '/(tabs)/home' },
  { key: 'book', label: 'Book', Icon: CalendarDays, href: '/book' },
  { key: 'chat', label: 'Chat', Icon: MessageCircle, href: '/chat' },
  { key: 'sessions', label: 'Sessions', Icon: Clock, href: '/(tabs)/sessions' },
  { key: 'profile', label: 'Profile', Icon: User, href: '/(tabs)/profile' },
];

/**
 * Height of the floating bar excluding the bottom safe-area inset
 * (wrap top pad 8 + blur pads 4+4 + icon row 24+12+12).
 * Non-tab screens add this as bottom margin so actions stay tappable.
 */
export const TAB_BAR_BASE = 64;

export function TabBar() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const current = segments[segments.length - 1] ?? 'home';
  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      <View style={styles.bar}>
        <BlurView intensity={80} tint="light" style={styles.blur}>
          {items.map(({ key, label, Icon, href }) => {
          const active = current === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              hitSlop={hitSlop}
              onPress={() => router.push(href)}
              style={[styles.item, active && styles.itemActive]}
            >
              <Icon
                size={sizes.iconButton}
                strokeWidth={active ? 2.5 : 2}
                color={active ? colors.ink : colors.muted}
              />
            </Pressable>
          );
        })}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  bar: {
    borderRadius: cardRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.55)',
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  blur: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: cardRadius },
  itemActive: { backgroundColor: colors.sun },
});
