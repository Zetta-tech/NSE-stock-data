import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f1117",
          raised: "#161922",
          overlay: "#1c1f2e",
          border: "#2a2d3e",
        },
        accent: {
          DEFAULT: "#00d4aa",
          hover: "#00e8bc",
          muted: "rgba(0, 212, 170, 0.12)",
        },
        danger: {
          DEFAULT: "#ef4444",
          muted: "rgba(239, 68, 68, 0.12)",
        },
        warn: {
          DEFAULT: "#f59e0b",
          muted: "rgba(245, 158, 11, 0.12)",
        },
        text: {
          primary: "#e8eaed",
          secondary: "#9ca3af",
          muted: "#6b7280",
        },
      },
      fontFamily: {
        heading: ["'General Sans'", "system-ui", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
