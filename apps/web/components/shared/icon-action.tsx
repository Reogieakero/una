"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/** Icon-only action button — meaning comes from the filter-card legend + tooltip. */
export function IconAction({
  label,
  variant,
  disabled,
  onClick,
  icon: Icon,
}: {
  label: string;
  variant: "accent" | "outline";
  disabled?: boolean;
  onClick: () => void;
  icon: typeof Check;
}) {
  return (
    <Button
      size="sm"
      variant={variant}
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="px-2.5"
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  );
}
