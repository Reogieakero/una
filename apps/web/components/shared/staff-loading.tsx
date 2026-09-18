/**
 * @deprecated — generic 3-card + 2-panel skeleton did not match any real
 * page (dashboards use hidden Stats + [1fr_320px] rails, reports use 8/4
 * p-6 KPIs + h-[240px] charts, boards use filter bars + wide tables, chat
 * uses 340px+1fr, calendar uses a 7-col grid, etc.).
 *
 * Kept as a re-export so existing `loading.tsx` imports don't break.
 * New code must import exact skeletons from `@/components/shared/skeletons`.
 */
export { CounselorDashboardSkeleton as StaffPageSkeleton } from "./skeletons";
