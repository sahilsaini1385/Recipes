import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#f7f5ef",
          warm: "#efece1",
          deep: "#ddd8c7",
        },
        ink: {
          DEFAULT: "#202a2e",
          soft: "#54646b",
          faint: "#8a99a0",
        },
        // Deep teal — passport-stamp green-blue
        accent: {
          DEFAULT: "#0f766e",
          dark: "#0b5a54",
          soft: "#d9efec",
        },
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
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
        card: "0 1px 2px rgba(32, 42, 46, 0.05), 0 4px 16px rgba(32, 42, 46, 0.07)",
        "card-hover":
          "0 2px 4px rgba(32, 42, 46, 0.06), 0 10px 28px rgba(15, 118, 110, 0.14)",
      },
    },
  },
  plugins: [],
} satisfies Config;
