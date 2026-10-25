// [@aula/eslint-config · Sprints 7.1/7.19 · RNF-32]: reglas de ESLint COMPARTIDAS por Next.js, NestJS y Angular — política «una librería por función» (las alternativas instaladas no se importan) | [Patrón]: Configuration as Code + SSOT | [Principio]: DRY (antes cada eslint.config.mjs la repetía) + mantenibilidad | [Paradigma]: Declarativo
// [Tecnología]: CommonJS sin dependencias → `import policy from "../../packages/eslint-config/index.js"` desde cualquier eslint.config.mjs (ESM importa CJS como `default`)
// [Uso]: `'no-restricted-imports': ['error', policy.next]` · NestJS y Angular igual con su clave; Python aplica la misma política con ruff (apps/ai-service/pyproject.toml)

module.exports = {
  // [Next.js]: fetch nativo (caché de Next) · @playwright/test (incluye el motor) · paquete unificado radix-ui
  next: {
    paths: [
      { name: "axios", message: "Usa fetch nativo (lib/api-client.ts): se integra con la caché de Next.js." },
      { name: "playwright", message: "Usa @playwright/test (incluye el motor)." },
    ],
    patterns: [{ group: ["@radix-ui/*"], message: 'Usa el paquete unificado radix-ui (import { Dialog } from "radix-ui").' }],
  },
  // [NestJS]: HttpService de @nestjs/axios (DI) · EventEmitter2 de @nestjs/event-emitter · @nestjs/swagger · @nestjs/jwt + passport-jwt
  nest: {
    paths: [
      { name: "axios", importNames: ["default"], message: "Usa HttpService de @nestjs/axios (DI); de axios solo se importan tipos y helpers como isAxiosError." },
      { name: "eventemitter2", message: "Usa EventEmitter2 de @nestjs/event-emitter." },
      { name: "swagger-ui-express", message: "@nestjs/swagger ya sirve su interfaz." },
      { name: "jose", message: "JWT propios con @nestjs/jwt + passport-jwt; jose solo en el verificador OIDC de Microsoft (JWKS remotos)." },
    ],
  },
  // [Angular]: tw-animate-css (animaciones) · Signals + RxJS (estado) · HttpClient (HTTP) → se añade a los `patterns` de las reglas por capa
  angular: {
    group: ["@angular/animations", "@angular/animations/*", "@ngrx/*", "axios"],
    message: "Dependencia no canónica: tw-animate-css (animaciones), Signals + RxJS (estado), HttpClient (HTTP).",
  },
};
