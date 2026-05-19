import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.25rem",
    },
    extend: {
      colors: {
        bg: "#f6f8fc",
        sidebar: "#1b2941",
        panel: "#ffffff",
        border: "#e3e8f2",
        muted: "#6c768b",
        ink: "#0f172a",
        accent: "#2a4368",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        soft: "0 10px 26px rgba(15, 23, 42, 0.06)",
        panel: "0 2px 10px rgba(16, 24, 40, 0.04), 0 12px 24px rgba(16, 24, 40, 0.05)",
      },
      fontFamily: {
        sans: ["Manrope", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
