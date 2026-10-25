import type { Config } from 'jest';
import presets from 'jest-preset-angular/presets/index.js'; // Ruta explícita: el config se carga como ES module
// [Jest · Angular 22]: jsdom con fetch/streams nativos (jest-fixed-jsdom → msw intercepta fetch), cobertura mínima y alias de rutas | [Patrón]: Configuration Object | [Principio]: SSOT (alias espejo de tsconfig.json) | [Tecnología]: jest-preset-angular 17 (zoneless)

const config: Config = {
  // `createCjsPreset` (jest-preset-angular): transforma TS/HTML con el compilador de Angular
  ...presets.createCjsPreset({ testEnvironment: 'jest-fixed-jsdom' }),
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // [ESM en node_modules]: además de .mjs, se transforman dependencias publicadas solo como ESM (until-async de msw, marked del Centro de ayuda)
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|.*until-async|.*marked|.*@angular/common/locales/.*\\.js$))'],
  // [Estructura uniforme con Next.js y NestJS]: pruebas en __tests__/ (unit = sin red · integration = repositorios y páginas con msw); functional/ y usability/ son de Playwright
  roots: ['<rootDir>/__tests__'],
  testMatch: ['<rootDir>/__tests__/unit/**/*.spec.ts', '<rootDir>/__tests__/integration/**/*.spec.ts'],
  // [Alias]: mismos que tsconfig.json → los imports @core/@shared/@features funcionan en las pruebas
  // [Sprint 7.1]: los paquetes de ../../packages no tienen node_modules → sus imports implícitos (tslib de ts-jest) se resuelven desde la app
  modulePaths: ['<rootDir>/node_modules'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/app/core/$1',
    '^@shared/(.*)$': '<rootDir>/src/app/shared/$1',
    '^@features/(.*)$': '<rootDir>/src/app/features/$1',
    '^@testing/(.*)$': '<rootDir>/__tests__/utils/$1',
    '^@aula/(.*)$': '<rootDir>/../../packages/$1', // [Sprint 7.1]: paquetes compartidos del monorepo (menú, diccionario, temas, valores de dominio)
  },
  // jest-fixed-jsdom: módulos de msw sin la condición "browser" (usa la versión node)
  testEnvironmentOptions: { customExportConditions: [''] },
  collectCoverageFrom: ['src/app/**/*.ts', '!src/app/**/*.routes.ts', '!src/app/**/*.providers.ts', '!src/app/elements.ts'],
  coverageThreshold: { global: { lines: 70, statements: 70 } }, // [Calidad]: cobertura mínima del remoto
};

export default config;
