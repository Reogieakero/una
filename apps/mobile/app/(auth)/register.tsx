import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerStudentSchema, type RegisterStudentInput } from "@dorsu/shared-schemas";
import { getSupabase } from "../../lib/supabase/client";
import { Button, Card, Field, Input } from "../../components/ui/primitives";
import { useRouter } from "expo-router";

/**
 * Student self-registration — STUDENTS ONLY, same registerStudentSchema as web.
 * Counselor/faculty accounts can only be provisioned by the guidance head
 * (web /users/new) — there is intentionally no role picker here, and the DB
 * enforces it too (profiles_insert_own_student forces role = 'student', and
 * the privilege-guard trigger blocks role self-promotion).
 *
 * Flow mirrors web /api/auth/register, adapted for RLS: signUp, then insert
 * your own profile row (student) + students row with a generated alias.
 */
function makeAlias(): string {
  return `Client-${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function RegisterScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { control, handleSubmit, formState } = useForm<RegisterStudentInput>({
    resolver: zodResolver(registerStudentSchema),
  });

  return (
    <ScrollView className="flex-1 bg-cream">
      <View className="p-6">
        <Card>
          <Text className="text-2xl font-bold text-ink">Create account</Text>
          <Text className="mb-3 mt-1 text-sm text-ink-muted">
            Students only — teachers and staff get their accounts from the Guidance office.
          </Text>
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
          {info && <Text className="mb-2 text-sm text-ink">{info}</Text>}
          <Button
            title={busy ? "Creating account…" : "Register"}
            disabled={busy}
            onPress={handleSubmit(async (v) => {
              setError(null);
              setInfo(null);
              setBusy(true);
              try {
                const supabase = getSupabase();
                const { data, error: signUpError } = await supabase.auth.signUp({
                  email: v.email,
                  password: v.password,
                });
                if (signUpError) return setError(signUpError.message);
                if (!data.user) return setError("Registration failed. Please try again.");
                if (!data.session) {
                  setInfo("Check your email to confirm your account, then sign in.");
                  return;
                }
                const userId = data.user.id;
                const rollbackProfile = async () => {
                  try {
                    await supabase.from("profiles").delete().eq("id", userId);
                  } catch {
                    // Best-effort: surfaces via the error shown below.
                  }
                };
                const { error: pErr } = await supabase.from("profiles").insert({
                  id: userId, email: v.email, role: "student", full_name: v.fullName,
                });
                if (pErr) return setError(pErr.message);
                // Unique alias with retries on collision (privacy-safe display name).
                // A student_no conflict aborts (that number belongs to another account);
                // any other error rolls the profile back best-effort and aborts.
                let alias: string | null = null;
                for (let attempt = 0; attempt < 5 && !alias; attempt++) {
                  const candidate = makeAlias();
                  const { error: sErr } = await supabase.from("students").insert({
                    profile_id: userId, student_no: v.studentNo, program: v.program, year_level: v.yearLevel,
                    anonymous_alias: candidate,
                  });
                  if (!sErr) {
                    alias = candidate;
                    break;
                  }
                  if (/student_no/i.test(sErr.message)) {
                    await rollbackProfile();
                    return setError("That student number is already registered.");
                  }
                  if (!/duplicate|unique|23505/i.test(sErr.message)) {
                    await rollbackProfile();
                    return setError(sErr.message);
                  }
                  // Alias collision — retry with a fresh candidate.
                }
                if (!alias) {
                  // Alias collisions exhausted — keep the account, alias can be backfilled.
                  setInfo("Account created. Sign in to continue.");
                  router.replace("/(student)/appointments");
                  return;
                }
                router.replace("/(student)/appointments");
              } finally {
                setBusy(false);
              }
            })}
          />
        </Card>
      </View>
    </ScrollView>
  );
}
