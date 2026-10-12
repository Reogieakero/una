import "../global.css";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

void SplashScreen.preventAutoHideAsync();

/** Root provider — TanStack Query over shared services, same as web. */
export default function RootLayout() {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }),
  );
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    setAppIsReady(true);
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Splash was already hidden.
      }
    }
  }, [appIsReady]);

  if (!appIsReady) return null;

  return (
    <QueryClientProvider client={client}>
      <View className="flex-1 bg-cream" onLayout={onLayoutRootView}>
        <Slot />
      </View>
    </QueryClientProvider>
  );
}
