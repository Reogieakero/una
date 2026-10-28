import { useEffect, useState } from 'react';
import { StatusBar, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { colors } from '@/theme';
import { NotificationsProvider } from '@/lib/notifications-context';
import { SessionReminderBanner } from '@/components/SessionReminderBanner';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, []);

  const ready = fontsLoaded || timedOut || fontError !== null;

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      {/* RN 0.88 (SDK 58) is edge-to-edge on Android; backgroundColor/translucent were removed. */}
      <StatusBar barStyle="dark-content" />
      <NotificationsProvider>
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: colors.cream },
            }}
          />
          {/* Root-level so the 30-minute session reminder shows on every screen. */}
          <SessionReminderBanner />
        </View>
      </NotificationsProvider>
    </SafeAreaProvider>
  );
}
