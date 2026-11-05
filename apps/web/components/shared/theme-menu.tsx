"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme, type ThemeMode } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Appearance picker rendered inside the staff profile menu. */
export function ThemeMenu() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="border-t border-white/10 px-2 py-2">
      <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-100/40">
        Appearance
      </p>
      <div
        role="group"
        aria-label="Theme preference"
        className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-white/[0.04] p-1"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              title={`${label} theme`}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-md text-[11px] font-bold transition",
                active
                  ? "bg-blue-500/20 text-white ring-1 ring-blue-400/30"
                  : "text-blue-100/50 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
