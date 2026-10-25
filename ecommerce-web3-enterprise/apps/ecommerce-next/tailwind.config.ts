import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate"; // Plugin de shadcn/ui: animaciones de entrada/salida según data-state de Radix

// SCALE => escala slate/gray leída de variables CSS (app/globals.css): en modo oscuro ".dark" invierte la escala, así
// las clases existentes (text-slate-600, bg-slate-100...) se adaptan solas sin agregar "dark:" en cada componente
const SCALE = Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [step, `rgb(var(--slate-${step}) / <alpha-value>)`]));

// tailwind.config.ts => define DÓNDE busca Tailwind las clases usadas (content) y el tema visual (theme)
const config: Config = {
  darkMode: "class", // Tema oscuro por clase en <html> (ThemeToggle + cookie "theme"), no solo por el sistema
  // "content" => Tailwind escanea estos paths para saber QUÉ clases generar (evita CSS muerto en el bundle final)
  // Incluye todas las capas FSD: app > widgets > features > entities > shared
  content: ["./app/**/*.{ts,tsx}", "./widgets/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}", "./entities/**/*.{ts,tsx}", "./shared/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Tokens de diseño de shadcn/ui: cada color lee una variable CSS de app/globals.css (una sola fuente de verdad,
      // DRY). "hsl(var(--x) / <alpha-value>)" => permite opacidades como bg-primary/80.
      colors: {
        slate: SCALE,
        gray: SCALE,
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: { DEFAULT: "hsl(var(--primary) / <alpha-value>)", foreground: "hsl(var(--primary-foreground) / <alpha-value>)" },
        secondary: { DEFAULT: "hsl(var(--secondary) / <alpha-value>)", foreground: "hsl(var(--secondary-foreground) / <alpha-value>)" },
        destructive: { DEFAULT: "hsl(var(--destructive) / <alpha-value>)", foreground: "hsl(var(--destructive-foreground) / <alpha-value>)" },
        muted: { DEFAULT: "hsl(var(--muted) / <alpha-value>)", foreground: "hsl(var(--muted-foreground) / <alpha-value>)" },
        accent: { DEFAULT: "hsl(var(--accent) / <alpha-value>)", foreground: "hsl(var(--accent-foreground) / <alpha-value>)" },
        popover: { DEFAULT: "hsl(var(--popover) / <alpha-value>)", foreground: "hsl(var(--popover-foreground) / <alpha-value>)" },
        // "brand" (v1) = alias del color primario: las pantallas existentes siguen funcionando sin cambios
        brand: { DEFAULT: "hsl(var(--primary) / <alpha-value>)" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      // Fuente autoalojada por next/font (variable CSS definida en app/layout.tsx)
      fontFamily: { sans: ["var(--font-inter)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [animate],
};

export default config;
