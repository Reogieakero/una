import AsyncStorage from "@react-native-async-storage/async-storage";

/** Persisted flag so the getting-started screens only show on first launch. */
export const ONBOARDING_SEEN_KEY = "@dorsu-mobile:onboarding-seen";

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "1");
  } catch {
    // Storage unavailable — onboarding will simply show again next launch.
  }
}
