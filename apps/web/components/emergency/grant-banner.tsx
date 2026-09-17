import { Badge, Card } from "@/components/ui/primitives";
import { fmtLeft, type EmergencyGrant } from "@/lib/hooks/use-emergency-grant";

/**
 * Active-grant banner — the step-2 card shell: grant alias, expiry countdown,
 * and whatever body the page composes inside (waiting notice, reveal CTA,
 * or the revealed identity card).
 */
export function GrantBanner({
  grant,
  msLeft,
  children,
}: {
  grant: EmergencyGrant;
  msLeft: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-red-300">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-ink">2 · Active grant — {grant.alias}</h2>
        <Badge tone={msLeft > 5 * 60 * 1000 ? "warning" : "danger"}>
          Expires in {fmtLeft(msLeft)}
        </Badge>
      </div>
      {children}
    </Card>
  );
}
