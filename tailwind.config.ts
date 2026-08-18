import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tokens de la Paleta B · 2026 — valores reales en src/app/globals.css (:root).
        // Cambiar de paleta a futuro es editar ese único archivo; estos nombres no cambian.
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        "border-2": "var(--border-2)",

        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "ink-3": "var(--ink-3)",

        primary: "var(--primary)",
        accent: "var(--accent)",
        "accent-2": "var(--accent-2)",

        ok: "var(--ok)",
        "ok-bg": "var(--ok-bg)",
        "ok-bd": "var(--ok-bd)",

        warn: "var(--warn)",
        "warn-bg": "var(--warn-bg)",
        "warn-bd": "var(--warn-bd)",

        bad: "var(--bad)",
        "bad-bg": "var(--bad-bg)",
        "bad-bd": "var(--bad-bd)",

        info: "var(--info)",
        chip: "var(--chip)",
        "chip-bd": "var(--chip-bd)",
        "chip-ink": "var(--chip-ink)",

        badge: "var(--badge)",
        "cta-bg": "var(--cta-bg)",
        "cta-ink": "var(--cta-ink)",

        // Etapas del embudo/pipeline (colores planos; los gradientes de fondo
        // viven en las clases .stage-1..4 de globals.css)
        s1: "var(--s1)",
        "s1-bd": "var(--s1-bd)",
        s2: "var(--s2)",
        "s2-bd": "var(--s2-bd)",
        s3: "var(--s3)",
        "s3-bd": "var(--s3-bd)",
        s4: "var(--s4)",
        "s4-bd": "var(--s4-bd)",
      },
      fontFamily: {
        sans: ["var(--font-arimo)", "Arial", "Helvetica", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
