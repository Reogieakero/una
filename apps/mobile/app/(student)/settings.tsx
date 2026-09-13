import { Text, View } from "react-native";
import { getSupabase } from "../../lib/supabase/client";
import { Button, Card } from "../../components/ui/primitives";
import { useRouter } from "expo-router";

export default function SettingsScreen() {
  const router = useRouter();
  return (
    <View className="flex-1 gap-3 bg-cream p-4">
      <Text className="text-2xl font-bold text-ink">Settings</Text>
      <Card><Text>Anonymous handling, reminders, and privacy. Synced to your profile.</Text></Card>
      <Button title="Sign out" variant="outline" onPress={async () => {
        await getSupabase().auth.signOut();
        router.replace("/(auth)/login");
      }} />
    </View>
  );
}
