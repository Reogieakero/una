import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Send from 'lucide-react-native/icons/send';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import {
  getThreadWithMessages,
  listThreads,
  markNotificationsRead,
  openThread as openChatThread,
  sendMessage,
} from '@dorsu/shared-services';
import type { ChatMessageRow, ChatThreadRow } from '@dorsu/shared-types';
import {
  colors,
  fontFamily,
  fontSize,
  radius,
  buttonRadius,
  spacing,
  sizes,
  hitSlop,
} from '@/theme';
import { IconButton } from '@/components/IconButton';
import { ChatBubble } from '@/components/ChatBubble';
import { Button } from '@/components/Button';
import { TabBar, TAB_BAR_BASE } from '@/components/TabBar';
import { getSupabase } from '@/lib/supabase/client';
import { loadCounselorDirectory } from '@/lib/counselors';
import { errorMessage } from '@/lib/errors';
import { useNotificationCount } from '@/lib/notifications-context';

type Me = { profileId: string; studentId: string; alias: string };
type ChatView = 'list' | 'thread';

const QUICK_REPLIES = ['Thank you', 'I need to talk', 'How do I reschedule?'];

// Supabase caches realtime channels by topic. If an effect re-runs (or React
// StrictMode double-invokes it) before the previous `removeChannel` settles,
// `channel(topic)` hands back the already-subscribed instance and adding
// postgres_changes throws. A process-wide sequence keeps every setup on a
// fresh topic, matching the notifications provider (00024 realtime).
let chatChannelSeq = 0;

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Time today, date older â€” used by the inbox rows. */
function listStamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? timeOf(iso)
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Student <-> Guidance chat, backed by `chat_threads` / `chat_messages`.
 *
 * Two levels: the inbox lists the student's conversations; tapping one opens
 * the dialog. Back from a dialog returns to the inbox, and back from the
 * inbox leaves the screen. The screen follows the RLS model: a student can
 * only open a thread for their own `students.id` and send as their own
 * profile. Messages arrive through the published `chat_messages` table
 * (00024); inserts are optimistic-deduped by id so the realtime echo and the
 * send response never double-render.
 */
export default function Chat() {
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<ChatView>('list');
  const [threads, setThreads] = useState<ChatThreadRow[]>([]);
  const [previews, setPreviews] = useState<Record<string, ChatMessageRow>>({});
  const [thread, setThread] = useState<ChatThreadRow | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [counselorNames, setCounselorNames] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const list = useRef<FlatList<ChatMessageRow> | null>(null);
  const { refresh: refreshUnread } = useNotificationCount();

  const scrollEnd = () => {
    setTimeout(() => list.current?.scrollToEnd({ animated: true }), 80);
  };

  const loadInbox = useCallback(async () => {
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Please log in again to use messages.');
        return;
      }

      const { data: studentRow } = await supabase
        .from('students')
        .select('id, anonymous_alias')
        .eq('profile_id', user.id)
        .maybeSingle();
      if (!studentRow) {
        setError('Your student profile is still being set up. Pull back and try again.');
        return;
      }

      const found: Me = {
        profileId: user.id,
        studentId: studentRow.id,
        alias: studentRow.anonymous_alias ?? 'your alias',
      };
      setMe(found);

      const [rows, directory] = await Promise.all([
        listThreads(supabase, found.studentId) as Promise<ChatThreadRow[]>,
        loadCounselorDirectory(supabase),
      ]);
      setThreads(rows);
      setCounselorNames(directory.names);

      // One bounded read per conversation for the "last message" preview.
      // Students keep a handful of threads, so N small reads stay cheap.
      const latest = await Promise.all(
        rows.slice(0, 20).map(async (t) => {
          const { data } = await supabase
            .from('chat_messages')
            .select('id, thread_id, sender_profile_id, body, created_at')
            .eq('thread_id', t.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          return [t.id, data as ChatMessageRow | null] as const;
        }),
      );
      const next: Record<string, ChatMessageRow> = {};
      for (const [id, row] of latest) {
        if (row) next[id] = row;
      }
      setPreviews(next);
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Could not load your messages.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadInbox();
    }, [loadInbox]),
  );

  const threadId = thread?.id ?? null;

  // Live replies for the open thread. Server rows are deduped by id against
  // the optimistic send result.
  useEffect(() => {
    if (!threadId) return;
    const supabase = getSupabase();
    const topic = `mobile-chat-${threadId}-${Date.now()}-${++chatChannelSeq}`;
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          setPreviews((prev) => ({ ...prev, [threadId]: row }));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId]);

  const clearChatNotifications = async (profileId: string) => {
    try {
      const supabase = getSupabase();
      const { data: unread } = await supabase
        .from('notifications')
        .select('id')
        .eq('profile_id', profileId)
        .eq('type', 'chat')
        .eq('is_read', false);
      const ids = ((unread ?? []) as { id: string }[]).map((n) => n.id);
      if (ids.length > 0) {
        await markNotificationsRead(supabase, ids);
        void refreshUnread();
      }
    } catch {
      // Badge cleanup is best-effort; the conversation still works.
    }
  };

  const openConversation = async (row: ChatThreadRow) => {
    setView('thread');
    setThread(row);
    setMessages([]);
    setDraft('');
    setError('');
    setOpening(true);
    try {
      const supabase = getSupabase();
      const detail = await getThreadWithMessages(supabase, row.id);
      setThread(detail.thread as ChatThreadRow);
      setMessages((detail.messages ?? []) as ChatMessageRow[]);
      if (me) void clearChatNotifications(me.profileId);
    } catch (e) {
      setError(errorMessage(e, 'Could not open this conversation.'));
    } finally {
      setOpening(false);
    }
  };

  const startConversation = () => {
    setView('thread');
    setThread(null);
    setMessages([]);
    setDraft('');
    setError('');
  };

  const backToList = useCallback(() => {
    setView('list');
    setThread(null);
    setMessages([]);
    setDraft('');
    setError('');
    void loadInbox();
  }, [loadInbox]);

  const handleBack = () => {
    if (view === 'thread') {
      backToList();
      return;
    }
    router.back();
  };

  // Android hardware back follows the same two-level flow instead of
  // popping the whole chat route while a dialog is open.
  useEffect(() => {
    if (view !== 'thread') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      backToList();
      return true;
    });
    return () => sub.remove();
  }, [view, backToList]);

  const send = async (text: string) => {
    const body = text.trim();
    if (body === '' || !me || sending || thread?.status === 'closed') return;
    setSending(true);
    setError('');
    try {
      const supabase = getSupabase();
      let active = thread;
      if (!active) {
        // First message: open the student's thread lazily so browsing the
        // inbox never creates empty threads.
        active = (await openChatThread(supabase, { studentId: me.studentId })) as ChatThreadRow;
        setThread(active);
      }
      const destination = active;
      setThreads((prev) =>
        prev.some((t) => t.id === destination.id) ? prev : [destination, ...prev],
      );
      const sent = (await sendMessage(supabase, {
        threadId: destination.id,
        senderProfileId: me.profileId,
        body,
      })) as ChatMessageRow;
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setPreviews((prev) => ({ ...prev, [destination.id]: sent }));
      setDraft('');
    } catch (e) {
      setError(errorMessage(e, 'Could not send your message. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const counselorName = thread?.counselor_id ? counselorNames[thread.counselor_id] : undefined;
  const who = counselorName ?? (thread?.counselor_id ? 'Counselor' : 'Guidance Office');
  const initial = who.slice(0, 1).toUpperCase();
  const closed = thread?.status === 'closed';
  const canSend = !sending && draft.trim() !== '' && !closed;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.header}>
          <IconButton
            tone="plain"
            label={view === 'thread' ? 'Back to conversations' : 'Go back'}
            onPress={handleBack}
          >
            <ArrowLeft size={sizes.tabIcon} color={colors.white} />
          </IconButton>
          {view === 'thread' ? (
            <>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={styles.who}>
                <Text style={styles.whoName}>{who}</Text>
                <Text style={styles.whoSub}>
                  {closed ? 'Conversation closed' : thread ? 'Open conversation' : 'Send a message to start'}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.who}>
              <Text style={styles.whoName}>Messages</Text>
              <Text style={styles.whoSub}>Guidance Office</Text>
            </View>
          )}
        </View>

        {view === 'list' ? (
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.blue} />
              <Text style={styles.helper}>Loading your conversationsâ€¦</Text>
            </View>
          ) : (
            <FlatList
              data={threads}
              keyExtractor={(t) => t.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.inbox,
                threads.length === 0 && styles.inboxEmpty,
              ]}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No conversations yet</Text>
                  <Text style={styles.emptyText}>
                    Start a conversation with the Guidance Office. A counselor will reply as soon as
                    they can.
                  </Text>
                  <Button label="Start a conversation" onPress={startConversation} />
                </View>
              }
              ListHeaderComponent={
                error !== '' ? (
                  <View style={styles.inboxError}>
                    <Text style={styles.errText}>{error}</Text>
                    <Button
                      label="Retry"
                      variant="outline"
                      onPress={() => {
                        setError('');
                        void loadInbox();
                      }}
                    />
                  </View>
                ) : null
              }
              renderItem={({ item }) => {
                const name = item.counselor_id
                  ? counselorNames[item.counselor_id] ?? 'Counselor'
                  : 'Guidance Office';
                const preview = previews[item.id];
                const mine = preview?.sender_profile_id === me?.profileId;
                const previewText = preview
                  ? `${mine ? 'You: ' : ''}${preview.body}`
                  : 'No messages yet';
                return (
                  <Pressable
                    onPress={() => void openConversation(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open conversation with ${name}`}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <View style={styles.rowAvatar}>
                      <Text style={styles.rowAvatarText}>{name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={styles.rowMain}>
                      <View style={styles.rowTop}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={styles.rowTime}>
                          {preview ? listStamp(preview.created_at) : ''}
                        </Text>
                      </View>
                      <Text style={styles.rowPreview} numberOfLines={1}>
                        {item.status === 'closed' ? 'Closed Â· ' : ''}
                        {previewText}
                      </Text>
                    </View>
                    <ChevronRight size={sizes.tabIcon} color={colors.muted} />
                  </Pressable>
                );
              }}
            />
          )
        ) : (
          <>
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                You are chatting as {me?.alias ?? 'your alias'}. Your name stays hidden unless
                safety requires it.
              </Text>
            </View>

            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={0}
            >
              {opening ? (
                <View style={styles.center}>
                  <ActivityIndicator color={colors.blue} />
                  <Text style={styles.helper}>Opening conversationâ€¦</Text>
                </View>
              ) : (
                <FlatList
                  ref={list}
                  data={messages}
                  keyExtractor={(m) => m.id}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={[styles.list, messages.length === 0 && styles.listEmpty]}
                  onContentSizeChange={scrollEnd}
                  renderItem={({ item }) => (
                    <ChatBubble
                      mine={item.sender_profile_id === me?.profileId}
                      text={item.body}
                      time={timeOf(item.created_at)}
                    />
                  )}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      <Text style={styles.emptyTitle}>Start a conversation</Text>
                      <Text style={styles.emptyText}>
                        Send a message to the Guidance Office. A counselor will reply as soon as
                        they can.
                      </Text>
                    </View>
                  }
                />
              )}

              {error !== '' ? (
                <View style={styles.errRow}>
                  <Text style={styles.errText}>{error}</Text>
                  <Button
                    label="Retry"
                    variant="outline"
                    onPress={() => {
                      setError('');
                      if (thread) void openConversation(thread);
                      else void loadInbox();
                    }}
                  />
                </View>
              ) : null}

              {closed ? (
                <Text style={styles.closedNote}>
                  This conversation is closed. Book a new session to talk with the Guidance Office
                  again.
                </Text>
              ) : (
                <>
                  <View style={styles.quick}>
                    {QUICK_REPLIES.map((q) => (
                      <Pressable
                        key={q}
                        onPress={() => void send(q)}
                        disabled={sending}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: sending }}
                        style={styles.quickBtn}
                      >
                        <Text style={styles.quickText}>{q}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.composer}>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder="Type a messageâ€¦"
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                      onSubmitEditing={() => void send(draft)}
                      returnKeyType="send"
                      editable={!sending}
                    />
                    <Pressable
                      onPress={() => void send(draft)}
                      disabled={!canSend}
                      hitSlop={hitSlop}
                      accessibilityRole="button"
                      accessibilityLabel="Send message"
                      accessibilityState={{ disabled: !canSend }}
                      style={[styles.send, !canSend && styles.sendOff]}
                    >
                      <Send size={sizes.tabIcon} color={colors.ink} />
                    </Pressable>
                  </View>
                </>
              )}
            </KeyboardAvoidingView>
          </>
        )}
      </SafeAreaView>

      {/* Same bottom navbar as the tabs â€” chat is a root stack screen. */}
      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  who: { flex: 1 },
  whoName: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.white },
  whoSub: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.white },
  banner: { backgroundColor: colors.sunSoft, padding: spacing.sm, paddingHorizontal: spacing.lg },
  bannerText: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.ink },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  helper: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  list: { padding: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  emptyTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
  },
  inbox: { paddingBottom: TAB_BAR_BASE + spacing.lg },
  inboxEmpty: { flexGrow: 1, justifyContent: 'center', paddingBottom: TAB_BAR_BASE + spacing.xl },
  inboxError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.creamLine,
  },
  rowPressed: { backgroundColor: colors.sunSoft },
  rowAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarText: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.white },
  rowMain: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowName: { flex: 1, fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.ink },
  rowTime: { fontFamily: fontFamily.regular, fontSize: fontSize.xs, color: colors.muted },
  rowPreview: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.muted },
  errRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  errText: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.danger,
  },
  closedNote: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    padding: spacing.lg,
    paddingBottom: TAB_BAR_BASE,
    textAlign: 'center',
  },
  quick: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  // Plain outline buttons â€” no card/shadow treatment on the composer actions.
  quickBtn: {
    borderRadius: buttonRadius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  quickText: { fontFamily: fontFamily.medium, fontSize: fontSize.sm, color: colors.blue },
  composer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    // Leave room for the absolute TabBar rendered over the screen.
    marginBottom: TAB_BAR_BASE,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.creamLine,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: sizes.buttonHeight,
    borderRadius: buttonRadius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.ink,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  send: {
    width: sizes.buttonHeight,
    height: sizes.buttonHeight,
    borderRadius: radius,
    backgroundColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { backgroundColor: colors.disabledBg },
});
