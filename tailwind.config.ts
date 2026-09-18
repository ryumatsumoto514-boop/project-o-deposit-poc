import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Single brand accent — Hyper Turquoise. Chosen over Cyber Amber
        // specifically because amber is already the app's semantic
        // "warning" color (see .banner-amber / btn-warning) — reusing it as
        // the primary accent too would make severity coding ambiguous.
        accent: {
          200: "#A6F7FF",
          300: "#66F2FF",
          400: "#22E7FA",
          500: "#00F0FF",
          600: "#00B8C4",
          700: "#008A94",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
