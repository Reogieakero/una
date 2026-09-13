/**
 * Brand color tokens — ONE source of truth.
 * Tailwind (web) and NativeWind (mobile) both import from here,
 * so a brand change is a one-file edit. Mirrors the existing
 * Chekie landing palette (calm blue + warm yellow on cream).
 */
export const colors = {
  cream: {
    DEFAULT: "#EFF6FF",
    dark: "#DBEAFE",
    deeper: "#BFDBFE",
  },
  ink: {
    DEFAULT: "#1E3A5F",
    soft: "#2D5A8E",
    muted: "#5A7FA0",
    faint: "#8BA4C4",
  },
  blue: {
    50: "#EFF6FF",
    100: "#DBEAFE",
    200: "#BFDBFE",
    300: "#93C5FD",
    400: "#60A5FA",
    500: "#3B82F6",
    600: "#2563EB",
    700: "#1D4ED8",
    800: "#1E40AF",
    900: "#1E3A8A",
  },
  yellow: {
    50: "#FFFBEB",
    100: "#FEF3C7",
    200: "#FDE68A",
    300: "#FCD34D",
    400: "#FBBF24",
    500: "#F59E0B",
    600: "#D97706",
    700: "#B45309",
  },
  primary: {
    50: "#EFF6FF",
    100: "#DBEAFE",
    200: "#BFDBFE",
    300: "#93C5FD",
    400: "#60A5FA",
    500: "#3B82F6",
    600: "#2563EB",
    700: "#1D4ED8",
    800: "#1E40AF",
    900: "#1E3A8A",
    DEFAULT: "#2563EB",
  },
  accent: {
    50: "#FFFBEB",
    100: "#FEF3C7",
    200: "#FDE68A",
    300: "#FCD34D",
    400: "#FBBF24",
    500: "#F59E0B",
    600: "#D97706",
    700: "#B45309",
    DEFAULT: "#FBBF24",
  },
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  // PSS-10 bands
  stress: {
    low: "#16A34A",
    moderate: "#D97706",
    high: "#DC2626",
  },
} as const;

export type Colors = typeof colors;
