import type { Config } from "tailwindcss";
import { colors, typography } from "@dorsu/ui-tokens";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1200px" },
    },
    extend: {
      // Brand palette: single source of truth in packages/ui-tokens (principle #6).
      colors: {
        cream: colors.cream,
        ink: colors.ink,
        blue: colors.blue,
        yellow: colors.yellow,
        primary: colors.primary,
        accent: colors.accent,
      },
      fontFamily: {
        display: ["var(--font-poppins)", ...typography.fontFamily.display],
        body: ["var(--font-nunito)", ...typography.fontFamily.body],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.75rem",
      },
      boxShadow: {
        soft: "0 12px 40px -12px rgba(37, 99, 235, 0.18)",
        card: "0 8px 30px -8px rgba(30, 58, 95, 0.12)",
        glow: "0 0 0 6px rgba(251, 191, 36, 0.18)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.9" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
        drift: {
          "0%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(18px, -18px)" },
          "100%": { transform: "translate(0, 0)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        breathe: "breathe 4.5s ease-in-out infinite",
        drift: "drift 12s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
