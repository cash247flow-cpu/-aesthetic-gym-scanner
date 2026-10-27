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
        // Neon lime accent (brighter than Tailwind's default lime).
        lime: { 200: "#eefdbd", 300: "#dcfb7c", 400: "#c6f432", 500: "#a9da12", 600: "#86b00a" },
      },
      fontFamily: {
        accent: ["var(--font-accent)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
