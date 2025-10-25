import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary:   "hsl(var(--color-primary))",
        secondary: "hsl(var(--color-secondary))",
        tertiary:  "hsl(var(--color-tertiary))",
        quaternary:"hsl(var(--color-quaternary))",
        quinary:   "hsl(var(--color-quinary))",
        bg:        "hsl(var(--color-bg))",
        card:      "hsl(var(--color-card))",
        muted:     "hsl(var(--color-muted))",
        border:    "hsl(var(--color-border))",
        text:      "hsl(var(--color-text))",
        "text-weak":"hsl(var(--color-text-weak))",
      },
      boxShadow: { soft: "0 4px 16px rgba(0,0,0,0.08)" },
      borderRadius: { xl2: "1rem" },
    },
  },
  plugins: [],
} satisfies Config;
