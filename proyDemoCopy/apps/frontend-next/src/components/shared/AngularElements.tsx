import Script from "next/script";
import { ANGULAR_ASSETS } from "@/config/angular";
// [AngularElements]: carga una vez el bundle del remoto Angular (registra <aula-exportar>, <aula-campana>…) | [Patrón]: Adapter (shell React ↔ Web Components) + Lazy Loading | [Principio]: DRY (cualquier página que use un Angular Element solo pone este componente) | [Paradigma]: Declarativo
// [Rendimiento]: `afterInteractive` → no bloquea el primer pintado · main.js solo descarga el chunk de elementos
// [Estilos]: SIN /ng/styles.css → globals.css genera las utilidades de las plantillas Angular con `@source` (un segundo Tailwind pisaba los breakpoints de Next)

// [2026-11-16 · caché vieja]: `?v=` cambia en cada arranque del servidor de Next → el navegador no reutiliza un main.js antiguo
// (el servidor anterior de Angular lo marcaba `immutable` por un año) | constante de módulo: misma URL en todas las páginas → next/script deduplica
const VERSION = Date.now().toString(36);

// `export function` (Server Component): sin estado; next/script deduplica por src
export function AngularElements() {
  // [2026-10-25]: `crossOrigin` → el <link rel=preload> que genera Next lleva el MISMO modo que el módulo (antes: «preload … not used because the request credentials mode does not match»)
  return <Script type="module" src={`${ANGULAR_ASSETS}/main.js?v=${VERSION}`} strategy="afterInteractive" crossOrigin="anonymous" />;
}
