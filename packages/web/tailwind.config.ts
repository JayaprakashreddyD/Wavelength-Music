import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          50: "#ffffff",
          100: "#f8fafc",
          200: "#f1f5f9",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          850: "#131d2e",
          900: "#0c131f",
          950: "#06090f",
        },
        accent: {
          DEFAULT: "#00f59b",
          dim: "#00c878",
          bright: "#57ffd0",
          glow: "rgba(0, 245, 155, 0.4)",
        },
        room: {
          DEFAULT: "#a855f7",
          dim: "#9333ea",
          bright: "#c084fc",
          glow: "rgba(168, 85, 247, 0.4)",
        },
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
