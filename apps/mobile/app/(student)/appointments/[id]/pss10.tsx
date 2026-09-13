import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PSS10_QUESTIONS, pss10SubmitSchema, type Pss10SubmitInput } from "@dorsu/shared-schemas";
import { submitPss10 } from "@dorsu/shared-services";
import { getSupabase } from "../../../../lib/supabase/client";
import { Button, Card, Field } from "../../../../components/ui/primitives";
import { TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

/** PSS-10 check-in — same questions + scoring service as web (principle #2/#3). */
export default function Pss10Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [studentId, setStudentId] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<Pss10SubmitInput>({
    resolver: zodResolver(pss10SubmitSchema),
    defaultValues: { answers: Array(10).fill(2) as number[], appointmentId: id },
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
    <ScrollView className="flex-1 bg-cream">
      <View className="gap-3 p-4">
        <Text className="text-2xl font-bold text-ink">Stress check-in</Text>
        {PSS10_QUESTIONS.map((q, i) => (
          <Card key={i}>
            <Field label={`${i + 1}. ${q}`}>
              <Controller
                control={control}
                name={`answers.${i as 0}`}
                render={({ field }) => (
                  <View className="flex-row gap-2">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => field.onChange(n)}
                        className={`flex-1 items-center rounded-xl border py-2 ${field.value === n ? "border-primary-600 bg-primary-50" : "border-ink/10"}`}
                      >
                        <Text className="font-bold">{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              />
            </Field>
          </Card>
        ))}
        <Button
          title="Submit check-in"
          disabled={!studentId}
          onPress={handleSubmit(async (v) => {
            if (!studentId) return;
            await submitPss10(getSupabase(), { studentId, answers: v.answers, appointmentId: id });
            router.replace("/(student)/appointments");
          })}
        />
      </View>
    </ScrollView>
  );
}
