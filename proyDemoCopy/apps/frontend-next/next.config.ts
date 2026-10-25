import type { NextConfig } from "next";
import path from "node:path";
import { ANGULAR_ASSETS, ANGULAR_PREFIXES, ANGULAR_PUBLIC_PREFIXES, ANGULAR_URL } from "./src/config/angular";
// [Next.js config]: raíz de Turbopack + rewrites hacia el remoto Angular 22 | [Patrón]: Reverse Proxy (rewrites) | [Principio]: SSOT (rutas en src/config/angular.ts)
// [Por qué rewrites]: el navegador ve un solo origen → la cookie httpOnly de sesión y el BFF /api/* sirven igual a Next.js y a Angular

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "tesseract.js"], // [2026-10-23]: extractor de texto (lib/extract-text) → require nativo de Node (workers y .wasm sin empaquetar)
  // [Navegación fluida · 2026-10-24]: Client Cache de Next.js — volver a una sección visitada en los últimos 30 s se pinta al instante (sin esperar al servidor)
  // Guardar/editar sigue fresco: las Server Actions llaman a revalidatePath y los formularios a router.refresh(), que invalidan esta caché | `experimental.staleTimes` (Next.js 14.2+)
  experimental: {
    staleTimes: { dynamic: 30, static: 300 },
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."), // [Sprint 7.1]: raíz del monorepo → Turbopack resuelve los paquetes compartidos de packages/* (@aula/*)
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
