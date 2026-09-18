import { CrumbSkeleton, PanelShellSkeleton, SkeletonRoot } from "@/components/shared/skeletons";

/**
 * Group fallback — only renders for (admin) routes without their own
 * `loading.tsx`. Neutral so it never misleads.
 */
export default function Loading() {
  return (
    <SkeletonRoot>
      <CrumbSkeleton />
      <div>
        <div className="h-7 w-56 rounded-lg bg-ink/10" />
        <div className="mt-2 h-4 w-full max-w-[600px] rounded-full bg-ink/10" />
      </div>
      <PanelShellSkeleton rows={3} />
    </SkeletonRoot>
  );
}
