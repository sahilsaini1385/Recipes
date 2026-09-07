import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#faf5ec",
          warm: "#f3e9d8",
          deep: "#e7d8bf",
          // The "engraved plate" surfaces: card stock, its hairline border,
          // the chart ground, and the rule used for connectors.
          card: "#fffdf8",
          line: "#dcc9a8",
          tree: "#f7efdf",
          rule: "#d8c5a5",
        },
        ink: {
          DEFAULT: "#2b2317",
          soft: "#6b5c45",
          faint: "#9c8a6d",
        },
        // Texas Longhorn burnt orange
        accent: {
          DEFAULT: "#bf5700",
          dark: "#9a4600",
          soft: "#fae7d4",
        },
      },
      fontFamily: {
        serif: ["Lora", "Georgia", "serif"],
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(43, 35, 23, 0.04), 0 4px 16px rgba(43, 35, 23, 0.06)",
        "card-hover":
          "0 2px 4px rgba(43, 35, 23, 0.06), 0 10px 28px rgba(191, 87, 0, 0.12)",
        // Warm ink-brown lift used by every "plate" surface.
        plate:
          "0 1px 2px rgba(78,59,33,0.06), 0 6px 16px -6px rgba(78,59,33,0.14)",
        "plate-hover":
          "0 2px 4px rgba(78,59,33,0.07), 0 10px 24px -6px rgba(191,87,0,0.16)",
      },
    },
  },
  plugins: [],
} satisfies Config;
