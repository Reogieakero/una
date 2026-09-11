import type { Config } from "tailwindcss";

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
      colors: {
        cream: {
          DEFAULT: "#FDF8F1",
          dark: "#F6EEE2",
          deeper: "#EFE3D2",
        },
        ink: {
          DEFAULT: "#2E2B33",
          soft: "#4A4654",
          muted: "#75707F",
          faint: "#A8A3B1",
        },
        sage: {
          50: "#F1F7F2",
          100: "#DFEDE1",
          200: "#C2DBC7",
          300: "#9DC2A6",
          400: "#76A583",
          500: "#5C8A69",
          600: "#486E54",
          700: "#3B5845",
        },
        lav: {
          50: "#F4F1FB",
          100: "#E9E3F8",
          200: "#D3C8F0",
          300: "#B6A3E3",
          400: "#9A82D1",
          500: "#8470B8",
        },
        skysoft: {
          50: "#EFF7FB",
          100: "#DDEFF7",
          200: "#BDE0F0",
          300: "#8FC8E3",
          400: "#6BAECF",
        },
        peach: {
          50: "#FFF1EC",
          100: "#FFE0D5",
          200: "#FFC4B2",
          300: "#FFA28A",
          400: "#FB8368",
          500: "#EE6B4E",
          600: "#D6543B",
        },
      },
      fontFamily: {
        display: ["var(--font-poppins)", "Nunito", "ui-rounded", "system-ui", "sans-serif"],
        body: ["var(--font-nunito)", "ui-rounded", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.75rem",
      },
      boxShadow: {
        soft: "0 12px 40px -12px rgba(72, 110, 84, 0.18)",
        card: "0 8px 30px -8px rgba(46, 43, 51, 0.12)",
        glow: "0 0 0 6px rgba(255, 162, 138, 0.18)",
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
