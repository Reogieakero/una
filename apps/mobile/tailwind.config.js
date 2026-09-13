import { colors } from "@dorsu/ui-tokens";

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Same single source as web (principle #6).
      colors: {
        cream: colors.cream,
        ink: colors.ink,
        primary: colors.primary,
        accent: colors.accent,
      },
    },
  },
  plugins: [],
};
