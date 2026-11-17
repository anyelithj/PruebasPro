// tailwind.config.ts (Tailwind CSS 3, vía @nuxtjs/tailwindcss) => mismos tokens de color que la tienda Next.js
// (consistencia visual entre frontends). "content" acota el escaneo a las capas FSD: CSS final mínimo (purge).
import type { Config } from "tailwindcss";

// SCALE => escala slate/gray leída de variables CSS (app/assets/css/tailwind.css): ".dark" la invierte (tema oscuro)
const SCALE = Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [step, `rgb(var(--slate-${step}) / <alpha-value>)`]));

export default {
  darkMode: "class", // Clase "dark" en <html> (ThemeToggle + cookie "theme" compartida con Next.js)
  content: ["./app/**/*.vue", "./features/**/*.{vue,ts}", "./widgets/**/*.vue", "./shared/**/*.{vue,ts}", "./content/**/*.md"],
  theme: {
    extend: {
      colors: {
        slate: SCALE,
        gray: SCALE,
        // brand = slate-900 / slate-50: en oscuro se invierte (botón claro con texto oscuro), contraste AA en ambos temas
        brand: { DEFAULT: "rgb(var(--brand) / <alpha-value>)", foreground: "rgb(var(--brand-foreground) / <alpha-value>)" },
        // secondary = botón de apoyo: en la tienda claro con borde; en el panel con tinte de marca (tailwind.css)
        secondary: { DEFAULT: "rgb(var(--secondary) / <alpha-value>)", foreground: "rgb(var(--secondary-foreground) / <alpha-value>)", border: "rgb(var(--secondary-border) / <alpha-value>)", hover: "rgb(var(--secondary-hover) / <alpha-value>)" },
        accent: { DEFAULT: "#2563eb", foreground: "#ffffff" },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] }, // Inter como Next.js (Google Fonts en nuxt.config); respaldo del sistema
    },
  },
  plugins: [],
} satisfies Config;
