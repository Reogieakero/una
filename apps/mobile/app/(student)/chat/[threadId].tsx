import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sendMessageSchema, type SendMessageInput } from "@dorsu/shared-schemas";
import { getThreadWithMessages, sendMessage } from "@dorsu/shared-services";
import { getSupabase } from "../../../lib/supabase/client";
import { Button, Card, Input } from "../../../components/ui/primitives";
import { useLocalSearchParams } from "expo-router";

/** Student chat thread — same sendMessageSchema + chat-service as web. */
export default function ChatThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const [messages, setMessages] = useState<any[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const { control, handleSubmit, reset } = useForm<SendMessageInput>({
    resolver: zodResolver(sendMessageSchema),
    defaultValues: { threadId: String(threadId ?? "") },
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await getSupabase().auth.getUser();
      setMe(user?.id ?? null);
      if (!threadId) return;
      const { messages } = await getThreadWithMessages(getSupabase(), String(threadId));
      setMessages(messages);
    })();
  }, [threadId]);

  return (
    <View className="flex-1 bg-cream p-4">
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <Card>
            <Text className={item.sender_profile_id === me ? "text-right text-primary-700" : ""}>{item.body}</Text>
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
          if (!me) return;
          await sendMessage(getSupabase(), { threadId: v.threadId, senderProfileId: me, body: v.body });
          reset({ threadId: v.threadId, body: "" } as any);
        })} />
      </View>
    </View>
  );
}
