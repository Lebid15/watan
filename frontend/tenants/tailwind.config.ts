import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["InterVariable", "ui-sans-serif", "system-ui"],
        arabic: ["TajawalVariable", "ui-sans-serif", "system-ui"],
      },
      colors: {
        // الخلفيات
        "bg-base": "rgb(var(--color-bg-base) / <alpha-value>)",
        "bg-surface": "rgb(var(--color-bg-surface) / <alpha-value>)",
        "bg-surface-alt": "rgb(var(--color-bg-surface-alt) / <alpha-value>)",
        "bg-modal": "rgb(var(--color-bg-modal) / <alpha-value>)",
        "bg-input": "rgb(var(--color-bg-input) / <alpha-value>)",
        "bg-subnav": "rgb(var(--color-subnav) / <alpha-value>)",

        // النصوص
        "text-primary": "rgb(var(--color-text-primary) / <alpha-value>)",
        "text-secondary": "rgb(var(--color-text-secondary) / <alpha-value>)",
        "text-inverse": "rgb(var(--color-text-inverse) / <alpha-value>)",

        // الألوان الأساسية
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "primary-hover": "rgb(var(--color-primary-hover) / <alpha-value>)",
        "primary-active": "rgb(var(--color-primary-active) / <alpha-value>)",
        "primary-contrast": "rgb(var(--color-primary-contrast) / <alpha-value>)",

        // الألوان الثانوية
        accent: "rgb(var(--color-accent) / <alpha-value>)",

        // حالات
        success: "rgb(var(--color-success) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",

        // حدود وروابط
        border: "rgb(var(--color-border) / <alpha-value>)",
        link: "rgb(var(--color-link) / <alpha-value>)",
      },
    },
  },
  plugins: [],
} satisfies Config;
