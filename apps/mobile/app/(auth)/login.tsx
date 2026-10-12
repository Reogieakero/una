import { useState } from "react";
import { View, Text } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@dorsu/shared-schemas";
import { getSupabase } from "../../lib/supabase/client";
import { Button, Card, Field, Input } from "../../components/ui/primitives";
import { useRouter } from "expo-router";

/** Student login — same loginSchema as web, AsyncStorage session under the hood. */
export default function LoginScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { control, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  return (
    <View className="flex-1 justify-center bg-cream p-6">
      <Card>
        <Text className="text-2xl font-bold text-ink">Welcome back</Text>
        <Text className="text-ink-muted">Sign in to Chekie.</Text>
        <View className="mt-4">
          <Field label="Email" error={formState.errors.email?.message}>
            <Controller control={control} name="email" render={({ field }) => (
              <Input keyboardType="email-address" autoCapitalize="none" onChangeText={field.onChange} value={field.value} />
            )} />
          </Field>
          <Field label="Password" error={formState.errors.password?.message}>
            <Controller control={control} name="password" render={({ field }) => (
              <Input secureTextEntry onChangeText={field.onChange} value={field.value} />
            )} />
          </Field>
          {error && <Text className="mb-2 text-sm text-red-600">{error}</Text>}
          <Button
            title={submitting ? "Signing in…" : "Sign in"}
            disabled={submitting}
            onPress={handleSubmit(async (v) => {
              setError(null);
              setSubmitting(true);
              try {
                const { error } = await getSupabase().auth.signInWithPassword(v);
                if (error) setError(error.message);
                else router.replace("/(student)/appointments");
              } finally {
                setSubmitting(false);
              }
            })}
          />
        </View>
      </Card>
    </View>
  );
}
