import type { NextConfig } from "next";
import path from "node:path";
import { ANGULAR_ASSETS, ANGULAR_DEV_BROWSER_URL, ANGULAR_PREFIXES, ANGULAR_PUBLIC_PREFIXES, ANGULAR_URL, LEGACY_VERIFY_PREFIX, VERIFY_PREFIX } from "./src/config/angular";
// [Next.js config]: raíz de Turbopack + rewrites hacia el remoto Angular 22 | [Patrón]: Reverse Proxy (rewrites) | [Principio]: SSOT (rutas en src/config/angular.ts)
// [Por qué rewrites]: el navegador ve un solo origen → la cookie httpOnly de sesión y el BFF /api/* sirven igual a Next.js y a Angular

const nextConfig: NextConfig = {
  // [Fix 2026-10-31 · chunks cortados en la primera carga]: `next dev` servía los chunks con gzip + `Transfer-Encoding: chunked`; todos los SyntaxError caían justo antes del final de su archivo y el archivo en disco estaba íntegro → el fallo está en la entrega, no en el build
  // `compress` (Next.js): sin gzip en desarrollo (también ahorra CPU en equipos justos) | `===`: en `next build`/`next start` sigue activo | [Patrón]: Configuration by Environment
  compress: process.env.NODE_ENV === "production",
  // [2026-10-23]: extractor de texto (lib/extract-text) → require nativo de Node (workers y .wasm de Tesseract sin empaquetar)
  // [2026-10-24]: SIN "pdfjs-dist" → el SSR de los lectores de PDF del navegador (lib/pdf-text) empaqueta su `new URL("pdfjs-dist/build/pdf.worker.min.mjs")` como asset;
  // con el paquete aquí, Turbopack avisaba «Package pdfjs-dist can't be external… require() resolves to an EcmaScript module». El servidor carga
  // pdfjs-dist/legacy/build/pdf.mjs con `import(/* webpackIgnore: true */ …)` nativo de Node (lib/extract-text-pdf) → tampoco se empaqueta
  serverExternalPackages: ["tesseract.js"],
  // [Navegación fluida · 2026-10-24]: Client Cache de Next.js — volver a una sección visitada en los últimos 30 s se pinta al instante (sin esperar al servidor)
  // Guardar/editar sigue fresco: las Server Actions llaman a revalidatePath y los formularios a router.refresh(), que invalidan esta caché | `experimental.staleTimes` (Next.js 14.2+)
  experimental: {
    // [agentUpgrade · 2026-11-16]: `false` (Next.js 16.4) → `next build`/`next dev` no ofrecen actualizar Next con un agente de código («Claude Code detected…») | versión fijada a propósito en 16.4.1 (package.json sin ^)
    agentUpgrade: false,
    staleTimes: { dynamic: 30, static: 300 },
    // [optimizePackageImports · 2026-10-24]: reescribe `import { Dialog } from "radix-ui"` al submódulo concreto → el barrel de Radix no arrastra los ~30 primitivos al bundle | [Rendimiento]: menos JS por ruta
    // lucide-react y recharts ya vienen en la lista por defecto de Next.js; radix-ui (paquete unificado) no
    optimizePackageImports: ["radix-ui"],
    // [serverActions.bodySizeLimit · 2026-10-25]: Server Actions (Next.js) aceptan hasta 1 MB por defecto → 2 MB, igual que el body-parser de NestJS, para guardar el contenido Markdown largo de un curso
    serverActions: { bodySizeLimit: "8mb" }, // [2026-11-03]: 2 → 8 MB (juegos con imágenes por palabra, como vocabulario)
    // [Fix 2026-11-02 · «memory allocation of 16777216 bytes failed»]: equipo de 8 GB con Angular + NestJS + FastAPI + Ollama → Turbopack (Rust) se quedaba sin RAM al compilar /resources
    // `turbopackMemoryEviction: "full"` (16.3+): tras guardar la caché en disco suelta la copia en memoria · `turbopackGc`: borra trabajo inalcanzable | `preloadEntriesOnStart: false`: no carga todas las páginas al arrancar
    // [Fix 2026-11-06]: SIN turbopackMemoryEviction "full" → con RAM justa dejaba `next dev` colgado en «Compiling / ...» (CPU ~0, sin error)
    turbopackGc: true,
    preloadEntriesOnStart: false,
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."), // [Sprint 7.1]: raíz del monorepo → Turbopack resuelve los paquetes compartidos de packages/* (@aula/*)
  },
  // [HMR de Angular detrás del proxy · 2026-10-24 · solo `next dev`]: el cliente de Vite (`/ng/@vite/client`) se pide DIRECTO al dev server de Angular (:9100) con una redirección 307
  // [Por qué funciona]: un módulo ES redirigido toma como `import.meta.url` la URL final → Vite calcula el WebSocket con el puerto 9100 y conecta al primer intento (Vite admite CORS en dev)
  // [Antes]: el socket salía hacia ws://localhost:9000/ng/ → Next.js responde 308 «/ng/ → /ng» y no reenvía el upgrade → error en consola y luego «Direct websocket connection fallback»
  // `process.env.NODE_ENV` (Next.js): «production» en `next build`/`next start` → sin la redirección (en producción Angular es estático, sin HMR) | [Patrón]: Configuration by Environment
  async redirects() {
    // [Caso E · 2026-11-13]: /verificar → /certificados/verificar (308 permanente, también en producción): los PDF ya emitidos llevan la URL vieja en su QR
    const legacyVerify = [
      { source: LEGACY_VERIFY_PREFIX, destination: VERIFY_PREFIX, permanent: true },
      { source: `${LEGACY_VERIFY_PREFIX}/:code`, destination: `${VERIFY_PREFIX}/:code`, permanent: true },
    ];
    if (process.env.NODE_ENV === "production") return legacyVerify;
    return [...legacyVerify, { source: `${ANGULAR_ASSETS}/@vite/client`, destination: `${ANGULAR_DEV_BROWSER_URL}${ANGULAR_ASSETS}/@vite/client`, permanent: false }];
  },
  // `rewrites` (Next.js): la URL del navegador no cambia; el contenido lo sirve Angular. Corren DESPUÉS de proxy.ts → la sesión ya se validó/renovó
  async rewrites() {
    return [
      // Assets del remoto (main.js, chunks, styles.css) servidos bajo /ng/ (deployUrl / servePath de Angular)
      { source: `${ANGULAR_ASSETS}/:path*`, destination: `${ANGULAR_URL}${ANGULAR_ASSETS}/:path*` },
      // Pantallas completas: index.html de Angular para la ruta y sus subrutas (el router de Angular decide)
      // `[...a, ...b]` (ES2015 spread): protegidas (PORTAL_PREFIXES) y públicas (/verificar) comparten el mismo rewrite
      ...[...ANGULAR_PREFIXES, ...ANGULAR_PUBLIC_PREFIXES].flatMap((prefix) => [
        { source: prefix, destination: `${ANGULAR_URL}${ANGULAR_ASSETS}/` },
        { source: `${prefix}/:path*`, destination: `${ANGULAR_URL}${ANGULAR_ASSETS}/` },
      ]),
    ];
  },
};

export default nextConfig;
