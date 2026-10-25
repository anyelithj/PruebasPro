// [lint-staged · raíz del repositorio]: revisa SOLO los archivos en stage de cada proyecto con su propia herramienta | [Patrón]: Strategy (un comando por tipo de proyecto) | [Principio]: DRY (una sola config para el monorepo) + Fail Fast | [Tecnología]: lint-staged 17 (ESM)
import { existsSync } from "node:fs"; // `node:` (Node ≥ 16): módulo nativo, sin dependencias

// [Python de ai-service]: el .venv de Windows o de Linux/macOS; si no existe, el python del sistema | `find` (ES2015) devuelve el primero que exista
const PYTHON =
  ["apps/ai-service/.venv/Scripts/python.exe", "apps/ai-service/.venv/bin/python"].find(existsSync) ?? "python";

// [Rutas entre comillas]: soporta carpetas con espacios o paréntesis como "(portal)" | `map` + `join` (ES5)
const quote = (files) => files.map((f) => `"${f}"`).join(" ");

// `export default` (ES2015): lint-staged recibe un objeto glob → función(archivos) → comandos
// Cada función recibe rutas ABSOLUTAS; `pnpm --dir <proyecto> exec` usa el ESLint y la config (eslint.config.mjs) de ESE proyecto
export default {
  // [Next.js]: ESLint 9 con --fix; si queda un error, el commit se detiene
  "apps/frontend-next/**/*.{ts,tsx,js,mjs}": (files) => `pnpm --dir apps/frontend-next exec eslint --fix ${quote(files)}`,
  // [Angular 22]: ESLint 9 + angular-eslint (reglas de capas y accesibilidad de plantillas) con su propio eslint.config.mjs
  "apps/frontend-angular/**/*.ts": (files) => `pnpm --dir apps/frontend-angular exec eslint --fix ${quote(files)}`,
  // [NestJS]: ESLint 9 + plugin Prettier (formato incluido en la regla prettier/prettier)
  "apps/backend/**/*.ts": (files) => `pnpm --dir apps/backend exec eslint --fix ${quote(files)}`,
  // [FastAPI]: ruff corrige lo automático y luego formatea | arreglo `[]` (lint-staged): los comandos corren en orden
  "apps/ai-service/**/*.py": (files) => [
    `${PYTHON} -m ruff check --fix ${quote(files)}`,
    `${PYTHON} -m ruff format ${quote(files)}`,
  ],
};
