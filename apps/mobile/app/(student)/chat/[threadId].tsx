import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sendMessageSchema, type SendMessageInput } from "@dorsu/shared-schemas";
import { getThreadWithMessages, sendMessage } from "@dorsu/shared-services";
import { getSupabase } from "../../../lib/supabase/client";
import { Button, Card, Input } from "../../../components/ui/primitives";
import { useLocalSearchParams } from "expo-router";

type Msg = {
  id: string;
  thread_id?: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
  /** Local-only: optimistic row awaiting server confirmation. */
  pending?: boolean;
};

/** RFC-4122 v4 (no new deps — expo-crypto isn't installed; Math.random is
 *  fine for idempotency keys, which need uniqueness, not secrecy). */
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const HISTORY_PAGE = 50;

/** Student chat thread — same sendMessageSchema + chat-service as web. */
export default function ChatThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const tid = String(threadId ?? "");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const { control, handleSubmit, reset } = useForm<SendMessageInput>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: { threadId: tid },
  });

  useEffect(() => {
    if (!tid) return;
    let alive = true;
    (async () => {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (!alive) return;
      setMe(user?.id ?? null);
      const { messages: ms } = await getThreadWithMessages(getSupabase(), tid);
      if (!alive) return;
      const list = ((ms ?? []) as Msg[]);
      setMessages(list);
      setHasMore(list.length >= HISTORY_PAGE);
    })().catch(() => {});
    // Live incoming messages — RLS scopes delivery to thread participants
    // server-side; the thread filter narrows it client-side. Cleanup on
    // unmount/thread switch so dead screens never accumulate sockets.
    const ch = getSupabase()
      .channel(`thread-${tid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${tid}` },
        (p) => {
          const row = p.new as Msg;
          setMessages((m) => (m.some((x) => x.id === row.id) ? m : [...m, row]));
        }
      )
      .subscribe();
    return () => {
      alive = false;
      getSupabase().removeChannel(ch).catch(() => {});
    };
  }, [tid]);

  const loadOlder = () => {
    if (!tid || !messages.length || loadingOlder) return;
    setLoadingOlder(true);
    getThreadWithMessages(getSupabase(), tid, { before: messages[0]?.created_at })
      .then(({ messages: ms }) => {
        const page = ((ms ?? []) as Msg[]);
        setMessages((m) => {
          const known = new Set(m.map((x) => x.id));
          return [...page.filter((x) => !known.has(x.id)), ...m];
        });
        if (page.length < HISTORY_PAGE) setHasMore(false);
      })
      .catch(() => {})
      .finally(() => setLoadingOlder(false));
  };

  return (
    <View className="flex-1 bg-cream p-4">
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={
          hasMore ? (
            <Button
              title={loadingOlder ? "Loading…" : "Load older messages"}
              onPress={loadOlder}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Card>
            <Text
              className={item.sender_profile_id === me ? "text-right text-primary-700" : ""}
              style={item.pending ? { opacity: 0.6 } : undefined}
            >
              {item.body}
            </Text>
          </Card>
        )}
        contentContainerStyle={{ gap: 8 }}
      />
      <View className="mt-2 flex-row gap-2">
        <View className="flex-1">
          <Controller control={control} name="body" render={({ field }) => (
            <Input placeholder="Message…" onChangeText={field.onChange} value={field.value} />
          )} />
        </View>
        <Button title="Send" onPress={handleSubmit(async (v) => {
          if (!me || !tid) return;
          // Optimistic send — renders instantly, clears the composer now.
          // The client UUID doubles as the idempotency key (service
          // messageId): retries reuse it and the realtime echo carries the
          // same id, so the temp row reconciles instead of duplicating.
          const body = v.body;
          const tempId = uuidv4();
          const optimistic: Msg = {
            id: tempId,
            thread_id: tid,
            sender_profile_id: me,
            body,
            created_at: new Date().toISOString(),
            pending: true,
          };
          setMessages((m) => [...m, optimistic]);
          reset({ threadId: tid, body: "" } as any);
          try {
            const sent = (await sendMessage(getSupabase(), {
              threadId: tid,
              senderProfileId: me,
              body,
              messageId: tempId,
            })) as unknown as Msg;
            setMessages((m) => m.map((x) => (x.id === tempId ? { ...sent, pending: false } : x)));
          } catch {
            setMessages((m) => m.filter((x) => x.id !== tempId));
          }
        })} />
      </View>
    </View>
  );
}
