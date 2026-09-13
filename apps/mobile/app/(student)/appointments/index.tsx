import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { Link } from "expo-router";
import { getSupabase } from "../../../lib/supabase/client";
import { listStudentAppointments } from "@dorsu/shared-services";
import { Button, Card } from "../../../components/ui/primitives";

/** Student appointment list — reads via shared queries, same gate as web. */
export default function AppointmentsScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: s } = await supabase.from("students").select("id").eq("profile_id", user.id).single();
      if (!s) return;
      setStudentId(s.id);
      setRows(await listStudentAppointments(supabase, s.id));
    })();
  }, []);

  return (
    <View className="flex-1 bg-cream p-4">
      <Text className="mb-3 text-2xl font-bold text-ink">My appointments</Text>
      <Link href="/(student)/appointments/new" asChild>
        <Button title="Book appointment" onPress={() => {}} />
      </Link>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ gap: 12, marginTop: 12 }}
        renderItem={({ item }) => (
          <Card>
            <Link href={`/(student)/appointments/${item.id}`}>
              <Text className="font-bold text-ink">{new Date(item.scheduled_at).toLocaleString()} · {String(item.status).replace(/_/g, " ")}</Text>
              <Text className="text-sm text-ink-muted" numberOfLines={2}>{item.concern}</Text>
            </Link>
          </Card>
        )}
        ListEmptyComponent={<Text className="mt-4 text-ink-muted">No appointments yet. Book your first visit.</Text>}
      />
      {studentId ? null : <Text>Loading…</Text>}
    </View>
  );
}
