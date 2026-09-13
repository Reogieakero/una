import { useState } from "react";
import { View, Text } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@dorsu/shared-schemas";
import { getSupabase } from "../../lib/supabase/client";
import { Button, Card, Field, Input } from "../../components/ui/primitives";

export default function ResetPasswordScreen() {
  const [done, setDone] = useState(false);
  const { control, handleSubmit } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });
  return (
    <View className="flex-1 justify-center bg-cream p-6">
      <Card>
        <Text className="text-2xl font-bold text-ink">Reset password</Text>
        <Field label="Email">
          <Controller control={control} name="email" render={({ field }) => (
            <Input keyboardType="email-address" autoCapitalize="none" onChangeText={field.onChange} value={field.value} />
          )} />
        </Field>
        <Button title="Send reset link" onPress={handleSubmit(async (v) => {
          await getSupabase().auth.resetPasswordForEmail(v.email);
          setDone(true);
        })} />
        {done && <Text className="mt-2 text-green-700">Check your inbox.</Text>}
      </Card>
    </View>
  );
}
