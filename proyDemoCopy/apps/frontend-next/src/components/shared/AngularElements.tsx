import Script from "next/script";
import { ANGULAR_ASSETS } from "@/config/angular";
// [AngularElements]: carga una vez el bundle del remoto Angular (registra <aula-exportar>, <aula-campana>…) | [Patrón]: Adapter (shell React ↔ Web Components) + Lazy Loading | [Principio]: DRY (cualquier página que use un Angular Element solo pone este componente) | [Paradigma]: Declarativo
// [Rendimiento]: `afterInteractive` → no bloquea el primer pintado · main.js solo descarga el chunk de elementos
// [Estilos]: SIN /ng/styles.css → globals.css genera las utilidades de las plantillas Angular con `@source` (un segundo Tailwind pisaba los breakpoints de Next)

// `export function` (Server Component): sin estado; next/script deduplica por src
export function AngularElements() {
  return <Script type="module" src={`${ANGULAR_ASSETS}/main.js`} strategy="afterInteractive" />;
}
