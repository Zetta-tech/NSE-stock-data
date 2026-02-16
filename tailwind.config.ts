import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0b0d11",
          raised: "#12151c",
          overlay: "#1a1e2a",
          border: "#252a3a",
        },
        accent: {
          DEFAULT: "#00d4aa",
          hover: "#00e8bc",
          dim: "#00a888",
          muted: "rgba(0, 212, 170, 0.10)",
          glow: "rgba(0, 212, 170, 0.15)",
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
          primary: "#edf0f5",
          secondary: "#9ca3af",
          muted: "#5c6370",
        },
      },
      fontFamily: {
        heading: ["'General Sans'", "system-ui", "sans-serif"],
        body: ["'General Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
