import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { hasSeenOnboarding } from "../lib/onboarding";

export default function Index() {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    hasSeenOnboarding().then(setSeen);
  }, []);

  if (seen === null) return null;
  return <Redirect href={seen ? "/(auth)/login" : "/onboarding"} />;
}
