import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Send from 'lucide-react-native/icons/send';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import {
  getThreadWithMessages,
  listStudentAppointments,
  listThreads,
  markNotificationsRead,
  messageableCounselors,
  openThread as openChatThread,
  sendMessage,
  type MessageableCounselor,
} from '@dorsu/shared-services';
import type { AppointmentRow, ChatMessageRow, ChatThreadRow } from '@dorsu/shared-types';
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
import { LumiFigure } from '@/components/mascot/Lumi';
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

/** "Today" / "Yesterday" / "Mon, Oct 20" — date separators inside a dialog. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function sameDay(a: string, b: string): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

/**
 * Inbox timestamp: time today, "Yesterday", weekday within the last week,
 * then the date (year only when it differs). Mirrors how mail/messaging apps
 * keep the right-hand column scannable.
 */
function listStamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (dayDiff <= 0) return timeOf(iso);
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString(
    'en-US',
    date.getFullYear() === now.getFullYear()
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
  );
}

/**
 * Student <-> Guidance chat, backed by `chat_threads` / `chat_messages`.
 *
 * Two levels: the inbox lists the counselors from the student's confirmed (or
 * completed) sessions plus any leftover conversations; tapping one opens the
 * dialog. Counselors are the entry point because a thread with
 * `counselor_id = null` is invisible to every staff inbox (00037 participant
 * policy + the web board filters by counselor id). Selecting a counselor
 * lazily calls `openThread({ counselorId })`, which reuses the existing open
 * thread. Back from a dialog returns to the inbox, and back from the inbox
 * leaves the screen. The screen follows the RLS model: a student can only
 * open a thread for their own `students.id` and send as their own profile.
 * Messages arrive through the published `chat_messages` table (00024);
 * inserts are optimistic-deduped by id so the realtime echo and the send
 * response never double-render.
 */
export default function Chat() {
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<ChatView>('list');
  const [threads, setThreads] = useState<ChatThreadRow[]>([]);
  const [previews, setPreviews] = useState<Record<string, ChatMessageRow>>({});
  const [thread, setThread] = useState<ChatThreadRow | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [counselorNames, setCounselorNames] = useState<Record<string, string>>({});
  const [counselorSpecialties, setCounselorSpecialties] = useState<Record<string, string>>({});
  const [sessionCounselors, setSessionCounselors] = useState<MessageableCounselor[]>([]);
  const [awaitingCounselor, setAwaitingCounselor] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [startingFor, setStartingFor] = useState<string | null>(null);
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

      const [rows, directory, appointments] = await Promise.all([
        listThreads(supabase, found.studentId) as Promise<ChatThreadRow[]>,
        loadCounselorDirectory(supabase),
        listStudentAppointments(supabase, found.studentId),
      ]);
      // Heads can own a `counselors` row but are not chat participants
      // (00037/00060): the staff board never lists student threads for them,
      // so a thread bound to a head would go unanswered. Hide both the contact
      // card and any leftover thread bound to one.
      const headCounselorIds = new Set(
        Object.entries(directory.roles)
          .filter(([, role]) => role === 'guidance_head')
          .map(([counselorId]) => counselorId),
      );
      const visibleThreads = rows.filter(
        (t) => !t.counselor_id || !headCounselorIds.has(t.counselor_id),
      );
      setThreads(visibleThreads);
      setCounselorNames(directory.names);
      setCounselorSpecialties(directory.specialties);
      // Confirmed + completed sessions are the only counselors a student may
      // message; one contact per counselor regardless of session count.
      const appts = (appointments ?? []) as AppointmentRow[];
      setSessionCounselors(
        messageableCounselors(appts).filter((c) => !headCounselorIds.has(c.counselorId)),
      );
      // A booked-but-unconfirmed request has no counselor yet, so the empty
      // state should point at Sessions rather than asking them to book again.
      setAwaitingCounselor(
        appts.some((a) => a.status === 'pending' || a.status === 'assigned'),
      );

      // One bounded read per conversation for the "last message" preview.
      // Students keep a handful of threads, so N small reads stay cheap.
      const latest = await Promise.all(
        visibleThreads.slice(0, 20).map(async (t) => {
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

  /**
   * Tapping a counselor card. Reuses the open thread when one exists;
   * otherwise creates one bound to that counselor so the staff inbox can
   * actually see it (00037 keeps threads participant-only).
   */
  const openWithCounselor = async (entry: MessageableCounselor) => {
    if (!me || opening) return;
    const existing = threads.find(
      (t) => t.status === 'open' && t.counselor_id === entry.counselorId,
    );
    if (existing) {
      await openConversation(existing);
      return;
    }
    setView('thread');
    setThread(null);
    setMessages([]);
    setDraft('');
    setError('');
    setStartingFor(entry.counselorId);
    setOpening(true);
    try {
      const supabase = getSupabase();
      const created = (await openChatThread(supabase, {
        studentId: me.studentId,
        counselorId: entry.counselorId,
      })) as ChatThreadRow;
      setThread(created);
      setThreads((prev) =>
        prev.some((t) => t.id === created.id)
          ? prev.map((t) => (t.id === created.id ? created : t))
          : [created, ...prev],
      );
      // A dedupe hit can return a thread that already has history.
      const detail = await getThreadWithMessages(supabase, created.id);
      setThread(detail.thread as ChatThreadRow);
      setMessages((detail.messages ?? []) as ChatMessageRow[]);
      void clearChatNotifications(me.profileId);
    } catch (e) {
      // Stay on the inbox so the retry banner is visible.
      setView('list');
      setThread(null);
      setError(errorMessage(e, 'Could not start that conversation. Please try again.'));
    } finally {
      setStartingFor(null);
      setOpening(false);
    }
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
    if (body === '' || !me || !thread || sending || thread.status === 'closed') return;
    setSending(true);
    setError('');
    try {
      const supabase = getSupabase();
      const sent = (await sendMessage(supabase, {
        threadId: thread.id,
        senderProfileId: me.profileId,
        body,
      })) as ChatMessageRow;
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setPreviews((prev) => ({ ...prev, [thread.id]: sent }));
      setThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? { ...t, updated_at: sent.created_at } : t)),
      );
      setDraft('');
    } catch (e) {
      setError(errorMessage(e, 'Could not send your message. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  const counselorName = thread?.counselor_id ? counselorNames[thread.counselor_id] : undefined;
  const who = counselorName ?? (thread?.counselor_id ? 'Counselor' : 'Guidance Office');
  const closed = thread?.status === 'closed';
  const canSend = !sending && thread !== null && draft.trim() !== '' && !closed;

  // Counselors above own their open threads — don't list the same
  // conversation twice in the inbox. Remaining rows are legacy/closed threads.
  const counselorThreadIds = new Set(
    sessionCounselors
      .map(
        (c) =>
          threads.find((t) => t.status === 'open' && t.counselor_id === c.counselorId)?.id,
      )
      .filter((id): id is string => typeof id === 'string'),
  );
  const otherThreads = threads.filter((t) => !counselorThreadIds.has(t.id));

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
              <View
                style={styles.avatar}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <LumiFigure look={4} feel="happy" size={30} />
              </View>
              <View style={styles.who}>
                <Text style={styles.whoName}>{who}</Text>
                <Text style={styles.whoSub}>
                  {closed ? 'Conversation closed' : 'Open conversation'}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.who}>
              <Text style={styles.whoName}>Messages</Text>
              <Text style={styles.whoSub}>Your counselors</Text>
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
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.inbox,
                sessionCounselors.length === 0 &&
                  otherThreads.length === 0 &&
                  styles.inboxEmpty,
              ]}
            >
              {error !== '' ? (
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
              ) : null}

              {sessionCounselors.length > 0 ? (
                <View>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionEyebrow}>YOUR COUNSELORS</Text>
                    <View style={styles.sectionCount}>
                      <Text style={styles.sectionCountText}>{sessionCounselors.length}</Text>
                    </View>
                  </View>
                  <Text style={styles.sectionHint}>
                    From your confirmed sessions · private to you two
                  </Text>
                  <View>
                    {sessionCounselors.map((entry) => {
                      const name = counselorNames[entry.counselorId] ?? 'Counselor';
                      const openThreadForCounselor = threads.find(
                        (t) => t.status === 'open' && t.counselor_id === entry.counselorId,
                      );
                      const preview = openThreadForCounselor
                        ? previews[openThreadForCounselor.id]
                        : undefined;
                      const mine = preview?.sender_profile_id === me?.profileId;
                      const busy = startingFor === entry.counselorId;
                      return (
                        <Pressable
                          key={entry.counselorId}
                          onPress={() => void openWithCounselor(entry)}
                          disabled={opening}
                          accessibilityRole="button"
                          accessibilityLabel={`Message ${name}`}
                          accessibilityHint={
                            counselorSpecialties[entry.counselorId] ?? 'Guidance counselor'
                          }
                          accessibilityState={{ disabled: opening }}
                          style={({ pressed }) => [
                            styles.threadRow,
                            pressed && styles.rowPressed,
                          ]}
                        >
                          <View style={styles.rowMain}>
                            <View style={styles.rowTop}>
                              <Text style={styles.rowName} numberOfLines={1}>
                                {name}
                              </Text>
                              <Text style={styles.rowTime}>
                                {listStamp(preview?.created_at ?? entry.scheduledAt)}
                              </Text>
                            </View>

                            <View style={styles.rowTop}>
                              <Text style={styles.rowPreview} numberOfLines={1}>
                                {preview ? (
                                  <>
                                    {mine ? (
                                      <Text style={styles.rowPreviewMine}>You: </Text>
                                    ) : null}
                                    {preview.body}
                                  </>
                                ) : (
                                  'No messages yet — say hello'
                                )}
                              </Text>
                              {busy ? (
                                <ActivityIndicator color={colors.blue} />
                              ) : (
                                <Text style={styles.rowAction}>
                                  {openThreadForCounselor ? 'Open' : 'Message'}
                                </Text>
                              )}
                            </View>
                          </View>
                          <View style={styles.threadDivider} />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {otherThreads.length > 0 ? (
                <View>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionEyebrow}>CONVERSATIONS</Text>
                    <View style={styles.sectionCount}>
                      <Text style={styles.sectionCountText}>{otherThreads.length}</Text>
                    </View>
                  </View>
                  <Text style={styles.sectionHint}>Ongoing and previous chats</Text>
                  <View>
                    {otherThreads.map((item) => {
                      const name = item.counselor_id
                        ? counselorNames[item.counselor_id] ?? 'Counselor'
                        : 'Guidance Office';
                      const preview = previews[item.id];
                      const mine = preview?.sender_profile_id === me?.profileId;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => void openConversation(item)}
                          accessibilityRole="button"
                          accessibilityLabel={`Open conversation with ${name}`}
                          style={({ pressed }) => [
                            styles.threadRow,
                            pressed && styles.rowPressed,
                          ]}
                        >
                          <View style={styles.rowMain}>
                            <View style={styles.rowTop}>
                              <Text style={styles.rowName} numberOfLines={1}>
                                {name}
                              </Text>
                              <Text style={styles.rowTime}>
                                {listStamp(preview?.created_at ?? item.updated_at)}
                              </Text>
                            </View>
                            <View style={styles.rowTop}>
                              <Text style={styles.rowPreview} numberOfLines={1}>
                                {preview ? (
                                  <>
                                    {mine ? (
                                      <Text style={styles.rowPreviewMine}>You: </Text>
                                    ) : null}
                                    {preview.body}
                                  </>
                                ) : (
                                  'No messages yet'
                                )}
                              </Text>
                              {item.status === 'closed' ? (
                                <View style={styles.closedPill}>
                                  <Text style={styles.closedPillText}>Closed</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>
                          <View style={styles.threadDivider} />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {sessionCounselors.length === 0 &&
              otherThreads.length === 0 &&
              error === '' ? (
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}>
                    <MessageCircle size={26} color={colors.blue} />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {awaitingCounselor ? 'Waiting for confirmation' : 'No counselors to message yet'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {awaitingCounselor
                      ? 'Your session request is with the Guidance Office. Once a counselor confirms it, they appear here.'
                      : 'Once a counselor confirms your session, they show up here and you can chat privately.'}
                  </Text>
                  {awaitingCounselor ? (
                    <Button
                      label="View my sessions"
                      onPress={() => router.push('/(tabs)/sessions')}
                    />
                  ) : (
                    <Button label="Book a session" onPress={() => router.push('/book')} />
                  )}
                </View>
              ) : null}
            </ScrollView>
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
                  renderItem={({ item, index }) => {
                    const previous = index > 0 ? messages[index - 1] : undefined;
                    const showDay =
                      !previous || !sameDay(previous.created_at, item.created_at);
                    return (
                      <View>
                        {showDay ? (
                          <View style={styles.dayRow}>
                            <View style={styles.dayPill}>
                              <Text style={styles.dayText}>{dayLabel(item.created_at)}</Text>
                            </View>
                          </View>
                        ) : null}
                        <ChatBubble
                          mine={item.sender_profile_id === me?.profileId}
                          text={item.body}
                          time={timeOf(item.created_at)}
                        />
                      </View>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={styles.empty}>
                      <Text style={styles.emptyTitle}>Say hello</Text>
                      <Text style={styles.emptyText}>
                        This conversation is only visible to you and {who}. Your name stays hidden.
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
                  This conversation is closed. Message your counselor from the list to start a new
                  one.
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
    borderRadius: 16,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
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
  dayRow: { alignItems: 'center', paddingVertical: spacing.sm },
  dayPill: {
    backgroundColor: colors.chip,
    borderRadius: radius,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  dayText: { fontFamily: fontFamily.medium, fontSize: fontSize.xxs, color: colors.muted },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.sky,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.lg, color: colors.ink },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
  },
  inbox: {
    paddingHorizontal: spacing.lg,
    paddingBottom: TAB_BAR_BASE + spacing.lg,
  },
  inboxEmpty: { flexGrow: 1, justifyContent: 'center', paddingBottom: TAB_BAR_BASE + spacing.xl },
  inboxError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  sectionEyebrow: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  sectionCount: {
    minWidth: 18,
    borderRadius: radius,
    backgroundColor: colors.sky,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCountText: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxs,
    color: colors.blue,
  },
  sectionHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.muted,
    paddingBottom: spacing.sm,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  // Hairline under every inbox row, spanning the 16px list gutter on both sides.
  threadDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.chip },
  rowMain: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowName: { flex: 1, fontFamily: fontFamily.bold, fontSize: fontSize.md, color: colors.ink },
  rowTime: { fontFamily: fontFamily.medium, fontSize: fontSize.xxs, color: colors.muted },
  rowPreview: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  rowPreviewMine: { fontFamily: fontFamily.medium, color: colors.muted },
  rowAction: { fontFamily: fontFamily.bold, fontSize: fontSize.xs, color: colors.blue },
  closedPill: {
    borderRadius: radius,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    backgroundColor: colors.disabledBg,
  },
  closedPillText: { fontFamily: fontFamily.bold, fontSize: fontSize.xxs, color: colors.muted },
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
