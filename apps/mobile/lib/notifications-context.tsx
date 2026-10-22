import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getSupabase } from '@/lib/supabase/client';

type NotificationCountValue = {
  unread: number;
  /** Re-read the exact unread count (used after mark-read and on focus). */
  refresh: () => Promise<void>;
};

const NotificationCountContext = createContext<NotificationCountValue>({
  unread: 0,
  refresh: async () => undefined,
});

/**
 * One realtime subscription per signed-in student session.
 *
 * The old Home screen read `listNotifications()` on focus, so the dot only
 * moved when the user came back to Home and never cleared. Badges are a
 * server-side fact (`notifications.is_read`) per profile, so the source of
 * truth stays in Postgres; realtime just tells us to re-read it.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0);
  const uidRef = useRef<string | null>(null);
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid) {
      setUnread(0);
      return;
    }
    const supabase = getSupabase();
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', uid)
      .eq('is_read', false);
    if (!error && aliveRef.current && uidRef.current === uid) setUnread(count ?? 0);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    const supabase = getSupabase();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // Guards overlapping setup() calls (INITIAL_SESSION + getUser() resolve
    // together). Without it, two setups race after `await refresh()`, and
    // supabase.channel() hands the second one the already-subscribed channel,
    // which throws when `.on('postgres_changes', …)` is added after subscribe.
    let setupSeq = 0;

    const teardown = () => {
      setupSeq += 1;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const setup = async (uid: string) => {
      if (uidRef.current === uid && channel) return;
      teardown();
      const mySeq = setupSeq;
      uidRef.current = uid;
      await refresh();
      if (!aliveRef.current || uidRef.current !== uid || mySeq !== setupSeq) return;
      channel = supabase
        .channel(`mobile-notif-${uid}-${mySeq}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${uid}` },
          () => void refresh(),
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `profile_id=eq.${uid}` },
          () => void refresh(),
        )
        .subscribe();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!aliveRef.current) return;
      if (event === 'SIGNED_OUT' || !session?.user) {
        teardown();
        uidRef.current = null;
        setUnread(0);
        return;
      }
      void setup(session.user.id);
    });

    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (aliveRef.current && user) void setup(user.id);
      })
      .catch(() => undefined);

    return () => {
      aliveRef.current = false;
      subscription.unsubscribe();
      teardown();
    };
  }, [refresh]);

  const value = useMemo(() => ({ unread, refresh }), [unread, refresh]);
  return <NotificationCountContext.Provider value={value}>{children}</NotificationCountContext.Provider>;
}

export function useNotificationCount(): NotificationCountValue {
  return useContext(NotificationCountContext);
}
