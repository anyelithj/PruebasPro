import type { NextConfig } from "next";
import path from "node:path";
import { ANGULAR_ASSETS, ANGULAR_DEV_BROWSER_URL, ANGULAR_PREFIXES, ANGULAR_PUBLIC_PREFIXES, ANGULAR_URL } from "./src/config/angular";
// [Next.js config]: raíz de Turbopack + rewrites hacia el remoto Angular 22 | [Patrón]: Reverse Proxy (rewrites) | [Principio]: SSOT (rutas en src/config/angular.ts)
// [Por qué rewrites]: el navegador ve un solo origen → la cookie httpOnly de sesión y el BFF /api/* sirven igual a Next.js y a Angular

const nextConfig: NextConfig = {
  // [2026-10-23]: extractor de texto (lib/extract-text) → require nativo de Node (workers y .wasm de Tesseract sin empaquetar)
  // [2026-10-24]: SIN "pdfjs-dist" → el SSR de los lectores de PDF del navegador (lib/pdf-text) empaqueta su `new URL("pdfjs-dist/build/pdf.worker.min.mjs")` como asset;
  // con el paquete aquí, Turbopack avisaba «Package pdfjs-dist can't be external… require() resolves to an EcmaScript module». El servidor carga
  // pdfjs-dist/legacy/build/pdf.mjs con `import(/* webpackIgnore: true */ …)` nativo de Node (lib/extract-text-pdf) → tampoco se empaqueta
  serverExternalPackages: ["tesseract.js"],
  // [Navegación fluida · 2026-10-24]: Client Cache de Next.js — volver a una sección visitada en los últimos 30 s se pinta al instante (sin esperar al servidor)
  // Guardar/editar sigue fresco: las Server Actions llaman a revalidatePath y los formularios a router.refresh(), que invalidan esta caché | `experimental.staleTimes` (Next.js 14.2+)
  experimental: {
    staleTimes: { dynamic: 30, static: 300 },
    // [optimizePackageImports · 2026-10-24]: reescribe `import { Dialog } from "radix-ui"` al submódulo concreto → el barrel de Radix no arrastra los ~30 primitivos al bundle | [Rendimiento]: menos JS por ruta
    // lucide-react y recharts ya vienen en la lista por defecto de Next.js; radix-ui (paquete unificado) no
    optimizePackageImports: ["radix-ui"],
    // [serverActions.bodySizeLimit · 2026-10-25]: Server Actions (Next.js) aceptan hasta 1 MB por defecto → 2 MB, igual que el body-parser de NestJS, para guardar el contenido Markdown largo de un curso
    serverActions: { bodySizeLimit: "2mb" },
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."), // [Sprint 7.1]: raíz del monorepo → Turbopack resuelve los paquetes compartidos de packages/* (@aula/*)
  },
  // [HMR de Angular detrás del proxy · 2026-10-24 · solo `next dev`]: el cliente de Vite (`/ng/@vite/client`) se pide DIRECTO al dev server de Angular (:9100) con una redirección 307
  // [Por qué funciona]: un módulo ES redirigido toma como `import.meta.url` la URL final → Vite calcula el WebSocket con el puerto 9100 y conecta al primer intento (Vite admite CORS en dev)
  // [Antes]: el socket salía hacia ws://localhost:9000/ng/ → Next.js responde 308 «/ng/ → /ng» y no reenvía el upgrade → error en consola y luego «Direct websocket connection fallback»
  // `process.env.NODE_ENV` (Next.js): «production» en `next build`/`next start` → sin la redirección (en producción Angular es estático, sin HMR) | [Patrón]: Configuration by Environment
  async redirects() {
    if (process.env.NODE_ENV === "production") return [];
    return [{ source: `${ANGULAR_ASSETS}/@vite/client`, destination: `${ANGULAR_DEV_BROWSER_URL}${ANGULAR_ASSETS}/@vite/client`, permanent: false }];
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
