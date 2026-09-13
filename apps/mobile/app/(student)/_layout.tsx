import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase/client";

/**
 * Student group guard — mirrors web's requireRole via shared rbac policy.
 * Only `student` role may enter; others are sent to auth.
 */
export default function StudentLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (data?.role !== "student") {
        router.replace("/(auth)/login");
        return;
      }
      setReady(true);
    })();
  }, [segments]);

  if (!ready) return null;
  return <Slot />;
}
