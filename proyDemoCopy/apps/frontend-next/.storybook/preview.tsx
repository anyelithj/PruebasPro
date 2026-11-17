// [Storybook preview · Next.js 16]: estilos globales + selector de tema + reglas a11y para TODAS las historias | [Patrón]: Decorator (envuelve cada historia) | [Principio]: DRY (configuración común en un solo sitio) | [Paradigma]: Funcional + Declarativo
import type { Decorator, Preview } from "@storybook/nextjs-vite";
import { sb } from "storybook/test"; // [sb.mock · Storybook 10]: sustituye módulos enteros por espías antes de cargar las historias
import "../src/app/globals.css"; // [Design Tokens]: misma hoja que la app (Tailwind v4 + @aula/ui-tokens) → las historias se ven igual que en producción | [Principio]: SSOT

// [Server Actions simuladas · 2026-11-17]: los módulos "use server" que importan los componentes (Google, compra, currículo) se cambian por espías
// → las historias se renderizan sin servidor ni cookies y el panel Actions muestra cada llamada | [Patrón]: Test Double (Mock) | [Principio]: Aislamiento
sb.mock(import("../src/app/(auth)/login/oauth-actions.ts"));
sb.mock(import("../src/lib/purchase-actions.ts"));
sb.mock(import("../src/app/(portal)/admin/curriculum/actions.ts"));

// [THEMES]: los 6 temas de @aula/ui-tokens (:root = claro) | [Principio]: SSOT (antes una copia local sin `vr`; un tema nuevo aparece aquí solo)
import { THEMES } from "@aula/ui-tokens/tailwind-preset";

// [withTheme]: aplica al <html> del iframe la clase del tema elegido en la barra de herramientas | [Patrón]: Decorator (HOC funcional) | [Principio]: OCP (añadir un tema = añadir un literal, sin tocar las historias)
const withTheme: Decorator = (Story, context) => {
  // `context.globals` (Storybook): valores de la barra de herramientas | `??` (JS): valor por defecto si es null/undefined
  const theme = (context.globals.theme as string | undefined) ?? "light";
  const root = document.documentElement; // `document.documentElement` (DOM): <html>, donde la app real pone la clase del tema
  root.classList.remove(...THEMES); // Spread (JS): quita el tema previo → un solo tema activo
  if (theme !== "light") root.classList.add(theme); // `light` = :root sin clase (igual que la app)
  // JSX (React): fondo y texto con los tokens → contraste real del tema en el lienzo
  return (
    <div className="bg-background text-foreground p-6">
      <Story />
    </div>
  );
};

// `const preview: Preview` (Storybook): configuración global tipada
const preview: Preview = {
  decorators: [withTheme],
  // [globalTypes]: menú «Tema» en la barra de herramientas | [Principio]: Accesibilidad (probar contraste en cada tema)
  globalTypes: {
    theme: {
      description: "Tema de la plataforma",
      toolbar: { title: "Tema", icon: "paintbrush", items: [...THEMES], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light" },
  parameters: {
    // [controls]: detecta props de color/fecha por nombre → control adecuado en el panel
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // [a11y]: `test: "error"` → una violación de axe marca la historia como fallida (Sprint 11.2: calidad antes de producción)
    a11y: { test: "error" },
    // [nextjs.appDirectory]: simula el App Router (useRouter/usePathname de next/navigation) | [Patrón]: Stub
    nextjs: { appDirectory: true },
  },
  tags: ["autodocs"], // [autodocs]: documentación generada desde los tipos de las props | [Principio]: Documentación viva
};

export default preview;
