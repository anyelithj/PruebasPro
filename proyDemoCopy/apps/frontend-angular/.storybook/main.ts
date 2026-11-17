// [Storybook · Sprint 11.2 · Angular 22]: catálogo visual de shared/ui (átomos, moléculas, organismos) | [Patrón]: Configuration Object | [Principio]: SoC (la documentación visual vive fuera de la app) | [Paradigma]: Declarativo
// `import type` (TypeScript): solo el tipo, se borra al compilar
import type { StorybookConfig } from '@storybook/angular';

// `const` (JS): referencia inmutable | `StorybookConfig` (Storybook): contrato tipado → errores en compilación (Type-Safe)
const config: StorybookConfig = {
  // [stories]: historias junto a cada componente de shared/ui (colocation) | [Principio]: Cohesión
  stories: ['../src/**/*.mdx', '../src/**/*.stories.ts'], // [2026-11-04]: + guías MDX (src/docs) antes que las historias
  // [addons]: docs (autodocs desde los input() del componente) + a11y (axe-core, WCAG 2.1 AA) | [Patrón]: Plugin
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  // [framework]: adaptador Angular; compila con los targets `storybook`/`build-storybook` de angular.json | [Patrón]: Adapter
  framework: { name: '@storybook/angular', options: {} },
  staticDirs: ['../public'], // Mismos assets que la app | [Principio]: DRY
  core: { disableTelemetry: true }, // Sin envío de datos de uso | [Principio]: Privacidad por defecto
};

export default config;
