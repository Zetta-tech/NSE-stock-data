import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#08090d",
          raised: "#0e1017",
          overlay: "#161922",
          border: "#1f2331",
          "border-bright": "#2a2f42",
        },
        accent: {
          DEFAULT: "#00e68a",
          hover: "#00ff99",
          dim: "#00b86e",
          muted: "rgba(0, 230, 138, 0.08)",
          glow: "rgba(0, 230, 138, 0.12)",
        },
        danger: {
          DEFAULT: "#ff4757",
          muted: "rgba(255, 71, 87, 0.10)",
        },
        warn: {
          DEFAULT: "#f5a623",
          muted: "rgba(245, 166, 35, 0.10)",
        },
        text: {
          primary: "#f0f2f7",
          secondary: "#8b92a5",
          muted: "#4a5068",
        },
      },
      fontFamily: {
        display: ["'Clash Display'", "'Satoshi'", "system-ui", "sans-serif"],
        heading: ["'Satoshi'", "system-ui", "sans-serif"],
        body: ["'Satoshi'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
