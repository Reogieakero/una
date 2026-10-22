import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import Bell from 'lucide-react-native/icons/bell';
import { listNotifications, markNotificationRead } from '@dorsu/shared-services';
import { getSupabase } from '@/lib/supabase/client';
import { useNotificationCount } from '@/lib/notifications-context';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

type Notice = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

function timeShort(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Only broadcast/office copy may show a body; clinical rows are title-only. */
function safeBody(n: Notice): string | null {
  if (!n.body) return null;
  return n.type === 'announcement' || n.type === 'system' ? n.body : null;
}

function destinationFor(link: string | null): string | null {
  if (!link) return null;
  if (link.startsWith('/chat')) return '/chat';
  if (link.startsWith('/appointments')) return '/(tabs)/sessions';
  if (link.startsWith('/announcements')) return '/(tabs)/home';
  return null;
}

export default function Notifications() {
  const { refresh } = useNotificationCount();
  const [rows, setRows] = useState<Notice[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const data = (await listNotifications(supabase, user.id)) as Notice[];
      setRows(data ?? []);
    } catch {
      setRows((prev) => prev ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const open = async (n: Notice) => {
    if (!n.is_read) {
      setBusyId(n.id);
      try {
        await markNotificationRead(getSupabase(), n.id);
        setRows((prev) =>
          prev ? prev.map((r) => (r.id === n.id ? { ...r, is_read: true } : r)) : prev,
        );
        await refresh();
      } catch {
        // Leave it unread; the next focus/realtime pass reconciles.
      } finally {
        setBusyId(null);
      }
    }
    const href = destinationFor(n.link);
    if (href) router.push(href as never);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.back}
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
      </View>

      {rows === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.blue} />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Bell size={28} color={colors.muted} />
          <Text style={styles.empty}>You&apos;re all caught up.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {rows.map((n) => {
            const body = safeBody(n);
            return (
              <Pressable
                key={n.id}
                onPress={() => void open(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n.is_read ? '' : 'Unread: '}${n.title}. ${timeShort(n.created_at)}`}
                style={[styles.card, !n.is_read && styles.unread]}
              >
                <View style={styles.cardHead}>
                  <Text style={[styles.cardTitle, !n.is_read && styles.cardTitleUnread]} numberOfLines={2}>
                    {n.title}
                  </Text>
                  <Text style={styles.time}>{timeShort(n.created_at)}</Text>
                </View>
                {body ? (
                  <Text style={styles.body} numberOfLines={3}>
                    {body}
                  </Text>
                ) : null}
                {!n.is_read ? (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{busyId === n.id ? 'Marking…' : 'New'}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          <Text style={styles.footnote}>
            Notifications show counts and generic updates only — open a session for details.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  back: { padding: spacing.xs },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.xl, color: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  empty: { fontFamily: fontFamily.medium, fontSize: fontSize.lg, color: colors.muted },
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  unread: { backgroundColor: colors.sky, borderColor: colors.sky },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardTitle: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.lg,
    color: colors.muted,
  },
  cardTitleUnread: { fontFamily: fontFamily.bold, color: colors.ink },
  time: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  body: { fontFamily: fontFamily.regular, fontSize: fontSize.md, color: colors.muted },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.blue,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pillText: { fontFamily: fontFamily.bold, fontSize: fontSize.xxs, color: colors.white },
  footnote: {
    marginTop: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
    textAlign: 'center',
  },
});
