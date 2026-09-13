import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { getSupabase } from "../../lib/supabase/client";
import { listNotifications, markNotificationRead } from "@dorsu/shared-services";
import { Button, Card } from "../../components/ui/primitives";

/** Student notifications — same notification-service as web. */
export default function NotificationsScreen() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (!user) return;
      setRows(await listNotifications(getSupabase(), user.id));
    })();
  }, []);
  return (
    <View className="flex-1 bg-cream p-4">
      <Text className="mb-3 text-2xl font-bold text-ink">Notifications</Text>
      <FlatList
        data={rows}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <Card>
            <Text className="font-bold text-ink">{item.title}</Text>
            <Text className="text-sm">{item.body}</Text>
            {!item.is_read && (
              <Button title="Mark read" variant="outline" onPress={async () => {
                await markNotificationRead(getSupabase(), item.id);
                setRows((r) => r.map((x) => (x.id === item.id ? { ...x, is_read: true } : x)));
              }} />
            )}
          </Card>
        )}
      />
    </View>
  );
}
