// [eslint.config.mjs · ESLint 9 · Angular 22]: ES module como Next.js y NestJS (eslint.config.mjs) | preset de angular-eslint + reglas de capas de Clean Architecture verificadas en CI | [Patrón]: Flat Config (composición de bloques) | [Principio]: Clean Architecture (dependencias hacia adentro) + bajo acoplamiento entre funcionalidades
// [Tecnología]: typescript-eslint + angular-eslint (plantillas incluidas)
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import policy from '../../packages/eslint-config/index.js';

// [Reglas de capas]: `no-restricted-imports` por carpeta | domain no conoce Angular HTTP ni router; application no conoce infraestructura; presentation no habla HTTP
const HTTP = { group: ['@angular/common/http'], message: 'Solo infrastructure/ usa HttpClient (repositorios).' };
const OTHER_FEATURE = { group: ['@features/*'], message: 'Una funcionalidad no importa a otra: usar router, eventos aula:* o core/shared.' };
// [Política de dependencias · Sprints 7.1/7.19]: compartida con Next.js y NestJS (@aula/eslint-config)
const NON_CANONICAL = policy.angular;
const layer = (files, patterns) => ({ files, rules: { 'no-restricted-imports': ['error', { patterns: [...patterns, NON_CANONICAL] }] } });

export default tseslint.config(
  { ignores: ['dist/**', '.angular/**', 'coverage/**', 'tools/feature-template/**'] },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates, // Analiza también las plantillas inline
    rules: {
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'aula', style: 'kebab-case' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'aula', style: 'camelCase' }],
    },
  },
  { files: ['src/**/*.ts'], rules: { 'no-restricted-imports': ['error', { patterns: [NON_CANONICAL] }] } }, // core/, shared/ y raíz (las capas de features lo repiten con sus reglas)
  { files: ['**/*.html'], extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility] }, // [A11y]: reglas WCAG en plantillas
  layer(['src/app/features/*/domain/**/*.ts'], [HTTP, OTHER_FEATURE, { group: ['@angular/router', '../application/*', '../infrastructure/*', '../presentation/*'], message: 'domain/ es puro: sin router ni otras capas.' }]),
  layer(['src/app/features/*/application/**/*.ts'], [HTTP, OTHER_FEATURE, { group: ['../infrastructure/*', '../presentation/*'], message: 'application/ depende del puerto, no del adaptador.' }]),
  layer(['src/app/features/*/presentation/**/*.ts'], [HTTP, OTHER_FEATURE, { group: ['../../infrastructure/*'], message: 'presentation/ usa la fachada, nunca el repositorio.' }]),
  layer(['src/app/features/*/infrastructure/**/*.ts'], [OTHER_FEATURE]),
  { files: ['__tests__/**/*.ts', 'tools/**/*.ts'], rules: { '@typescript-eslint/no-non-null-assertion': 'off', 'no-restricted-imports': 'off' } },
);
