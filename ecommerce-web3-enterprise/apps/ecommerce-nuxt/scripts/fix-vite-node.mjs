// fix-vite-node.mjs => parche local de @nuxt/vite-builder para Windows (se ejecuta antes de "nuxt dev").
// Motivo: la ruta del repo + carpetas de pnpm superan 260 caracteres y Node 22 no resuelve los "imports" del
// package.json (#vite-node) en rutas largas => error 500 "Package import specifier #vite-node is not defined".
// Cambia esos imports por rutas relativas (./vite-node.mjs), que Node sí carga. Idempotente; se repite tras cada install.
// ponytail: parche en node_modules; quitar cuando el repo viva en ruta corta o pnpm >= 9.1 con virtual-store-dir-max-length
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const store = resolve(import.meta.dirname, "../../../node_modules/.pnpm");
const ALIASES = { "#vite-node-runner": "./vite-node-runner.mjs", "#vite-node": "./vite-node.mjs" };

for (const dir of existsSync(store) ? readdirSync(store).filter((name) => name.startsWith("@nuxt+vite-builder@")) : []) {
  for (const file of ["vite-node-entry.mjs", "vite-node-runner.mjs"]) {
    const path = join(store, dir, "node_modules/@nuxt/vite-builder/dist", file);
    if (!existsSync(path)) continue;
    const code = readFileSync(path, "utf8");
    const patched = Object.entries(ALIASES).reduce((src, [alias, rel]) => src.replaceAll(`from "${alias}"`, `from "${rel}"`), code);
    if (patched !== code) writeFileSync(path, patched);
  }
}
