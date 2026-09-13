import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerStudentSchema, type RegisterStudentInput } from "@dorsu/shared-schemas";
import { getSupabase } from "../../lib/supabase/client";
import { Button, Card, Field, Input } from "../../components/ui/primitives";
import { useRouter } from "expo-router";

/** Student registration — same registerStudentSchema as any future web student form. */
export default function RegisterScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<RegisterStudentInput>({
    resolver: zodResolver(registerStudentSchema),
  });

  return (
    <ScrollView className="flex-1 bg-cream">
      <View className="p-6">
        <Card>
          <Text className="text-2xl font-bold text-ink">Create account</Text>
          {(["fullName", "email", "password", "studentNo", "program", "yearLevel"] as const).map((name) => (
            <Field key={name} label={name} error={formState.errors[name]?.message}>
              <Controller
                control={control}
                name={name}
                render={({ field }) => (
                  <Input
                    secureTextEntry={name === "password"}
                    autoCapitalize="none"
                    onChangeText={field.onChange}
                    value={field.value}
                  />
                )}
              />
            </Field>
          ))}
          {error && <Text className="mb-2 text-sm text-red-600">{error}</Text>}
          <Button
            title="Register"
            onPress={handleSubmit(async (v) => {
              setError(null);
              const supabase = getSupabase();
              const { data, error } = await supabase.auth.signUp({ email: v.email, password: v.password });
              if (error) return setError(error.message);
              if (data.user) {
                const { error: pErr } = await supabase.from("profiles").insert({
                  id: data.user.id, email: v.email, role: "student", full_name: v.fullName,
                });
                if (pErr) return setError(pErr.message);
                await supabase.from("students").insert({
                  profile_id: data.user.id, student_no: v.studentNo, program: v.program, year_level: v.yearLevel,
                });
              }
              router.replace("/(student)/appointments");
            })}
          />
        </Card>
      </View>
    </ScrollView>
  );
}
