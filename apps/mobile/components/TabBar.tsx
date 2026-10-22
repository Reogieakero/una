import { View, Pressable, StyleSheet, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useSegments, type Href } from 'expo-router';
import Home from 'lucide-react-native/icons/house';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Clock from 'lucide-react-native/icons/clock';
import User from 'lucide-react-native/icons/user';
import type { LucideIcon } from 'lucide-react-native';
import { colors, spacing, hitSlop, sizes, fontSize } from '@/theme';
import { useNotificationCount } from '@/lib/notifications-context';

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
 * Height of the bar excluding the bottom safe-area inset
 * (1px hairline + 50px icon row). Non-tab screens add this as bottom margin
 * so actions stay tappable.
 */
export const TAB_BAR_BASE = 51;

/**
 * Instagram-style tab bar: full-width, flush to the bottom, evenly spaced
 * icon-only items above a hairline. No floating capsule and no pill
 * highlight — the active tab is read from icon weight/color plus a small dot.
 */
export function TabBar() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { unread } = useNotificationCount();
  const current = segments[segments.length - 1] ?? 'home';
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BlurView
        intensity={95}
        tint="light"
        style={[styles.bar, { paddingBottom: insets.bottom }]}
      >
        <View style={styles.hairline} />
        <View style={styles.row}>
          {items.map(({ key, label, Icon, href }) => {
            const active = current === key;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={key === 'home' && unread > 0 ? `Home, ${unread} unread notifications` : label}
                hitSlop={hitSlop}
                // Chat is a root stack screen: pressing its own tab again
                // would push a duplicate chat on top of the current one.
                onPress={() => {
                  if (active) return;
                  router.push(href);
                }}
                style={styles.item}
              >
                <View style={styles.iconWrap}>
                  <Icon
                    size={sizes.tabBarIcon}
                    strokeWidth={active ? 2.4 : 1.9}
                    color={active ? colors.sun : colors.muted}
                  />
                  {key === 'home' && unread > 0 ? (
                    <View style={styles.badge} pointerEvents="none">
                      <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.dot, active && styles.dotActive]} />
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    height: 50,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: fontSize.xxs,
    fontWeight: '700',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  dotActive: {
    backgroundColor: colors.sun,
  },
});
