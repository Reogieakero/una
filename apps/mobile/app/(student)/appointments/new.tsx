import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAppointmentSchema, type CreateAppointmentInput } from "@dorsu/shared-schemas";
import { bookAppointment, getLatestPss10, isPss10Fresh } from "@dorsu/shared-services";
import { getSupabase } from "../../../lib/supabase/client";
import { Button, Card, Field, Input } from "../../../components/ui/primitives";
import { useRouter } from "expo-router";

/**
 * Booking screen — validates with the SAME createAppointmentSchema as web and
 * enforces the PSS-10 gate via the SAME bookAppointment service (principle #2).
 */
export default function NewAppointmentScreen() {
  const router = useRouter();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [gateOk, setGateOk] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: { mode: "in_person", isAnonymous: false },
  });

  useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: s } = await supabase.from("students").select("id").eq("profile_id", user.id).single();
      if (!s) return;
      setStudentId(s.id);
      const latest = await getLatestPss10(supabase, s.id).catch(() => null);
      setGateOk(!!latest && isPss10Fresh(latest.created_at));
    })();
  }, []);

  return (
    <ScrollView className="flex-1 bg-cream">
      <View className="p-4">
        <Text className="mb-3 text-2xl font-bold text-ink">Book appointment</Text>
        {gateOk === false && (
          <Card>
            <Text className="text-sm text-ink">Complete a PSS-10 check-in first (required within 30 days).</Text>
          </Card>
        )}
        <Card>
          <Field label="Concern" error={formState.errors.concern?.message}>
            <Controller control={control} name="concern" render={({ field }) => (
              <Input multiline numberOfLines={4} onChangeText={field.onChange} value={field.value} />
            )} />
          </Field>
          <Field label="Scheduled at (ISO, e.g. 2026-09-20T09:00)" error={(formState.errors.scheduledAt as any)?.message}>
            <Controller control={control} name="scheduledAt" render={({ field }) => (
              <Input placeholder="2026-09-20T09:00:00" onChangeText={field.onChange} value={String(field.value ?? "")} />
            )} />
          </Field>
          {error && <Text className="mb-2 text-sm text-red-600">{error}</Text>}
          <Button
            title="Request appointment"
            disabled={!studentId}
            onPress={handleSubmit(async (v) => {
              try {
                setError(null);
                if (!studentId) return;
                await bookAppointment(getSupabase(), {
                  studentId,
                  scheduledAt: new Date(v.scheduledAt),
                  mode: v.mode,
                  concern: v.concern,
                  isAnonymous: v.isAnonymous,
                  pss10Id: v.pss10Id,
                });
                router.replace("/(student)/appointments");
              } catch (e: any) {
                setError(e.message ?? "Booking failed");
              }
            })}
          />
        </Card>
      </View>
    </ScrollView>
  );
}
