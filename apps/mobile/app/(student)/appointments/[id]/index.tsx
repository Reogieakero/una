import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, Link, useRouter } from "expo-router";
import { getSupabase } from "../../../../lib/supabase/client";
import {
  cancelAppointment,
  getAppointmentDetail,
  rescheduleAppointment,
} from "@dorsu/shared-services";
import { Button, Card, Field, Input } from "../../../../components/ui/primitives";

const ACTIVE = ["pending", "assigned", "confirmed"];

function statusLabel(s: string): string {
  const spaced = s.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<any>(null);
  const [newWhen, setNewWhen] = useState("");
  const [busy, setBusy] = useState<"cancel" | "reschedule" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setRow(await getAppointmentDetail(getSupabase(), String(id)));
    } catch {
      setError("Couldn't load this appointment.");
    }
  }, [id]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  if (!row)
    return (
      <View className="flex-1 bg-cream p-4">
        <Text>{error ?? "Loading…"}</Text>
      </View>
    );

  const active = ACTIVE.includes(row.status);
  const when = new Date(row.scheduled_at).toLocaleString();

  const doCancel = async () => {
    try {
      setBusy("cancel");
      setError(null);
      await cancelAppointment(getSupabase(), String(id));
      await load();
    } catch (e: any) {
      setError(e.message ?? "Couldn't cancel — it may have changed status.");
    } finally {
      setBusy(null);
    }
  };

  const doReschedule = async () => {
    try {
      setBusy("reschedule");
      setError(null);
      const d = new Date(newWhen);
      if (Number.isNaN(d.getTime())) {
        setError("Enter a valid date/time, e.g. 2026-09-20T09:00:00");
        return;
      }
      await rescheduleAppointment(getSupabase(), String(id), d);
      setNewWhen("");
      await load();
    } catch (e: any) {
      setError(e.message ?? "Couldn't reschedule — pick a future time.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className="flex-1 gap-3 bg-cream p-4">
      <Card>
        <Text className="text-lg font-bold text-ink">{when}</Text>
        <Text className="text-ink-muted">
          {statusLabel(row.status)} · {row.mode === "online" ? "Online" : "In person"}
        </Text>
        <Text className="mt-2">{row.concern}</Text>
      </Card>

      {active ? (
        <Card>
          <Text className="mb-1 text-base font-bold text-ink">Manage this booking</Text>
          <Text className="mb-3 text-sm text-ink-muted">
            Only you can cancel or reschedule — completion is marked by your counselor after the session.
          </Text>
          <Field label="New date/time (e.g. 2026-09-20T09:00:00)">
            <Input placeholder="2026-09-20T09:00:00" value={newWhen} onChangeText={setNewWhen} />
          </Field>
          {error && <Text className="mb-2 text-sm text-red-600">{error}</Text>}
          <View className="gap-2">
            <Button
              title={busy === "reschedule" ? "Rescheduling…" : "Reschedule session"}
              disabled={busy !== null}
              onPress={doReschedule}
            />
            <Button
              title={busy === "cancel" ? "Cancelling…" : "Cancel session"}
              variant="outline"
              disabled={busy !== null}
              onPress={doCancel}
            />
          </View>
        </Card>
      ) : (
        <Card>
          <Text className="text-sm text-ink-muted">
            This session is {statusLabel(row.status).toLowerCase()} and can't be changed. Book a new one if needed.
          </Text>
          <View className="mt-3">
            <Button title="Book a new session" onPress={() => router.replace("/(student)/appointments/new")} />
          </View>
        </Card>
      )}

      <Link href={`/(student)/appointments/${row.id}/pss10`} asChild>
        <Button title="Open PSS-10 check-in" onPress={() => {}} />
      </Link>
      <Link href={`/(student)/appointments/${row.id}/feedback`} asChild>
        <Button title="Leave feedback" variant="outline" onPress={() => {}} />
      </Link>
    </View>
  );
}
