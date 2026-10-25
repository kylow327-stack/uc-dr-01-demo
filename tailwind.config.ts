import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12151A",
        navy: "#1B2A4A",
        paper: "#F6F4EF",
        stone: "#E7E1D6",
        signal: "#C45C26",
        line: "#D9D3C8",
        muted: "#8A8175",
        ember: "#F28C4E",
      },
      fontFamily: {
        sans: ["var(--font-barlow)", "Barlow", "sans-serif"],
        display: ["var(--font-barlow-condensed)", "Barlow Condensed", "sans-serif"],
        mono: ["var(--font-dm-mono)", "DM Mono", "ui-monospace", "monospace"],
      },
      maxWidth: {
        page: "72rem",
      },
    },
  },
  plugins: [],
};

export default config;
