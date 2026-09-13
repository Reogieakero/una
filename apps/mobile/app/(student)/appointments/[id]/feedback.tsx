import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { feedbackSchema, type FeedbackInput } from "@dorsu/shared-schemas";
import { submitFeedback } from "@dorsu/shared-services";
import { getSupabase } from "../../../../lib/supabase/client";
import { Button, Card, Field, Input } from "../../../../components/ui/primitives";
import { useLocalSearchParams, useRouter } from "expo-router";

/** Post-session feedback — same feedbackSchema + service as web. */
export default function FeedbackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [studentId, setStudentId] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<FeedbackInput>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { appointmentId: String(id ?? ""), rating: 5 },
  });
  useEffect(() => {
    (async () => {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (!user) return;
      const { data: s } = await getSupabase().from("students").select("id").eq("profile_id", user.id).single();
      if (s) setStudentId(s.id);
    })();
  }, []);
  return (
    <View className="flex-1 bg-cream p-4">
      <Card>
        <Text className="text-lg font-bold text-ink">How was your session?</Text>
        <Field label="Rating (1–5)" error={formState.errors.rating?.message}>
          <Controller control={control} name="rating" render={({ field }) => (
            <View className="flex-row gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => field.onChange(n)} className={`flex-1 items-center rounded-xl border py-2 ${field.value === n ? "border-accent-500 bg-yellow-100" : "border-ink/10"}`}>
                  <Text className="font-bold">{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )} />
        </Field>
        <Field label="Comment">
          <Controller control={control} name="comment" render={({ field }) => (
            <Input multiline onChangeText={field.onChange} value={field.value ?? ""} />
          )} />
        </Field>
        <Button title="Submit feedback" disabled={!studentId} onPress={handleSubmit(async (v) => {
          if (!studentId) return;
          await submitFeedback(getSupabase(), { appointmentId: String(id), studentId, rating: v.rating, comment: v.comment });
          router.replace("/(student)/appointments");
        })} />
      </Card>
    </View>
  );
}
