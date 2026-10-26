import { redirect } from "next/navigation"; // [Next.js]: redirección server-side (307) antes de renderizar
import { parseTab, type ActivityTab } from "@/lib/activities-api";
// [Página /actividades · 2026-10-23]: entrada «Actividades» del menú → abre la SECCIÓN completa del remoto Angular (Práctica, Juegos, Música, Diálogos, Poliglota)
// Antes esta página listaba otra versión reducida (p. ej. Diálogos = solo biblioteca) y el «Volver» de cada actividad llevaba a la del remoto → dos pantallas distintas para lo mismo.
// Ahora cada sección es UNA pantalla con las mismas pills de secciones arriba (<aula-activity-sections>) | [Patrón]: Redirect + Configuration Object | [Principio]: DRY + SSOT (una vista por sección)

// [HUBS]: pestaña → pantalla de la sección en Angular | `satisfies` (TS 4.9): exige las 5 claves sin ensanchar el tipo
const HUBS = {
  practice: "/practica",
  games: "/juegos",
  music: "/musica",
  dialogues: "/dialogos",
  polyglot: "/poliglota",
  reading: "/lectura", // [2026-10-25]: lista de lecturas del estudiante (Angular)
} as const satisfies Partial<Record<ActivityTab, string>>;

export default async function ActivitiesPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const tab = parseTab((await props.searchParams).tab);
  // `in` (JS): pestaña de estudiante conocida; «grammar» u otra → Práctica
  redirect(tab in HUBS ? HUBS[tab as keyof typeof HUBS] : HUBS.practice);
}
