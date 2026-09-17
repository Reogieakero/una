"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export const YEAR_OPTIONS = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
] as const;

/** Custom shadcn-style dropdown (designed panel — not the native OS menu). */
export function YearLevelSelect({
  value,
  onChange,
  hasError,
}: {
  value: string;
  onChange: (v: string) => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = YEAR_OPTIONS.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={ref} className="relative">
      <GraduationCap
        className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
      <button
        type="button"
        id="yearLevel"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full rounded-2xl border bg-white py-2.5 pl-11 pr-10 text-left text-sm transition",
          "focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200",
          hasError ? "border-red-300" : "border-ink/15",
          selected ? "font-semibold text-ink" : "text-ink-faint"
        )}
      >
        {selected ? selected.label : "Choose your year"}
      </button>
      <ChevronDown
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted transition-transform",
          open && "rotate-180"
        )}
      />
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-ink/10 bg-white p-1.5 shadow-card">
          <ul role="listbox" aria-labelledby="yearLevel" className="space-y-0.5">
            {YEAR_OPTIONS.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition",
                      active
                        ? "bg-primary-600 text-white shadow-soft"
                        : "text-ink hover:bg-cream"
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                          active ? "bg-white/20 text-white" : "bg-blue-50 text-primary-700"
                        )}
                      >
                        {o.value}
                      </span>
                      {o.label}
                    </span>
                    {active && <Check className="h-4 w-4" aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
