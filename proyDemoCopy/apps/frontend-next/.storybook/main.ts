// [Storybook · Sprint 11.2 · Next.js 16]: catálogo visual de los átomos/moléculas de components/ui | [Patrón]: Configuration Object | [Principio]: SoC (la documentación visual vive fuera de la app) | [Paradigma]: Declarativo
// `import type` (TypeScript): importa solo el tipo, se borra al compilar → cero peso en runtime
import type { StorybookConfig } from "@storybook/nextjs-vite";

// `const` (JS): referencia inmutable | `StorybookConfig` (Storybook): contrato tipado de la configuración → errores en compilación, no en runtime (Type-Safe)
const config: StorybookConfig = {
  // [stories]: historias junto a cada componente (colocation) | [Principio]: Cohesión (componente + historia en la misma carpeta)
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"], // [2026-11-04]: + guías MDX (src/docs) antes que las historias
  // [addons]: docs (autodocs desde los tipos de las props) + a11y (axe-core en cada historia, WCAG 2.1 AA) | [Patrón]: Plugin
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  // [framework]: Next.js sobre Vite (soporta next/image, next/link, next/navigation y PostCSS/Tailwind v4 de postcss.config.mjs) | [Patrón]: Adapter
  framework: { name: "@storybook/nextjs-vite", options: {} },
  // [staticDirs]: sirve /public igual que Next (favicon, imágenes) | [Principio]: DRY (mismos assets)
  staticDirs: ["../public"],
  // [telemetry off]: sin envío de datos de uso | [Principio]: Privacidad por defecto
  core: { disableTelemetry: true },
  // [experimentalRSC · 2026-11-17]: renderiza Server Components ASÍNCRONOS (CourseCard, ManagementHeader) en el navegador de Storybook | [Patrón]: Adapter
  features: { experimentalRSC: true },
};

// `export default` (ESM): Storybook lee la exportación por defecto
export default config;
