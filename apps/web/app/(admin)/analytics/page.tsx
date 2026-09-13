import { redirect } from "next/navigation";

/** Legacy endpoint — the head home moved to /dashboard. */
export default function AnalyticsRedirect() {
  redirect("/dashboard");
}
