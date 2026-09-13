import { StaffPageSkeleton } from "@/components/shared/staff-loading";

/** Content-only skeleton — shell (nav + sidebar) stays mounted above this. */
export default function Loading() {
  return <StaffPageSkeleton />;
}
