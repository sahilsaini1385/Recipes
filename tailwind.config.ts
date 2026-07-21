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
      },
    },
  },
  plugins: [],
} satisfies Config;
