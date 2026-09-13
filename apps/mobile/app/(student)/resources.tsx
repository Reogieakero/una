import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { getSupabase } from "../../lib/supabase/client";
import { Card } from "../../components/ui/primitives";

/** Wellness resources — published announcements with student audience. */
export default function ResourcesScreen() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await getSupabase().from("announcements").select("*").order("published_at", { ascending: false }).limit(20);
      setRows(data ?? []);
    })();
  }, []);
  return (
    <View className="flex-1 gap-3 bg-cream p-4">
      <Text className="text-2xl font-bold text-ink">Resources</Text>
      {rows.map((a) => (
        <Card key={a.id}>
          <Text className="font-bold text-ink">{a.title}</Text>
          <Text className="text-sm text-ink-muted">{a.body}</Text>
        </Card>
      ))}
      {!rows.length && <Text className="text-ink-muted">No resources yet.</Text>}
    </View>
  );
}
