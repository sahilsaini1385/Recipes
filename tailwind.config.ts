import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#faf6ef",
          warm: "#f4ecdf",
          deep: "#ece1cf",
        },
        ink: {
          DEFAULT: "#2d2417",
          soft: "#6b5d49",
          faint: "#9c8d76",
        },
        accent: {
          DEFAULT: "#b4552d",
          dark: "#93441f",
          soft: "#f3ddd2",
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
    },
  },
  plugins: [],
} satisfies Config;
