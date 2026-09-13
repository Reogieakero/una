/** Spacing scale — single source for web Tailwind + mobile NativeWind. */
export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  "2xl": "3rem",
  "3xl": "4rem",
  container: "1.5rem",
  maxWidth: "1200px",
  radius: {
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "4xl": "2rem",
    "5xl": "2.75rem",
    full: "9999px",
  },
} as const;

export type Spacing = typeof spacing;
