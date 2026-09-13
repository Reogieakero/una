"use client";

import { useState } from "react";
import { Dropdown } from "./dropdown";

const TIMES = Array.from({ length: 24 * 4 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  const v = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { value: v, label: `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}` };
});

/**
 * shadcn-style time picker — a single dropdown of times in 15-minute steps,
 * same border/radius/focus ring as the other form controls. Value is "HH:MM".
 */
export function TimePicker({
  id,
  value,
  onChange,
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  return (
    <Dropdown
      menuKey={id}
      openMenuKey={openMenuKey}
      onOpenChange={setOpenMenuKey}
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      buttonClassName="min-w-[132px] px-3"
      options={TIMES}
    />
  );
}
