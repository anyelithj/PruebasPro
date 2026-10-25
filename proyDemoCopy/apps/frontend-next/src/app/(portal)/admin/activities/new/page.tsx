import type { Metadata } from "next"; // [Next.js]: tipo de la Metadata API | `import type` (TS): se borra al compilar
import Link from "next/link"; // [Next.js]: las tarjetas de tipo son enlaces reales → funcionan sin JavaScript
import { FileUp, PenLine, Sparkles, type LucideIcon } from "lucide-react"; // [lucide-react]: iconos SVG uniformes
import { BackLink } from "@/components/shared/BackLink";
import { Step } from "@/components/curriculum/CurriculumItemForm"; // [DRY]: MISMO bloque numerado de «Crear recurso»
import { cn } from "@/lib/utils";
import { Suspense } from "react"; // `useSearchParams` del paso 1 exige un límite de Suspense
import { ActivityLangLevel } from "@/components/admin/ActivityLangLevel"; // [2026-10-24]: paso «¿Para qué idioma y nivel?»
import { isLanguage, LEVEL_OPTIONS } from "@/lib/languages";
import { ACTIVITY_TAB_KEYS, ACTIVITY_TABS, parseTab, withReturn } from "@/lib/activities-api";
// [Página /admin/activities/new · 2026-10-23 · 4.º pase]: «Crear actividad» con el paso «¿Qué vas a crear?» igual que Gestión → Recursos → Crear recurso
// [2026-10-24]: Paso 1 = idioma y nivel (como «Crear recurso») → viajan a los editores como ?idioma=&nivel=
// Paso 2 = tarjetas por sección (Práctica, Juegos, Música, Diálogos, Poliglota, Gramática) · Paso 3 = cómo crearla (a mano, con IA, importando)
// [Patrón]: Container (RSC) + URL State (?tab=) + Configuration Object (ACTIVITY_TABS) | [Principio]: OCP (sección nueva = entrada en ACTIVITY_TABS) + DRY (Step compartido) | [Paradigma]: Declarativo
// [A11y]: aria-current="true" marca la tarjeta elegida (no solo el color) · `<a>` en el paso 2: los editores son pantallas del remoto Angular (navegación completa)

export const metadata: Metadata = {
  title: "Crear actividad",
  robots: { index: false, follow: false }, // [SEO]: página privada del portal
};

// [Modo]: forma de alta disponible por sección | `ReadonlyArray` (TS): inmutable
type Mode = { key: "href" | "ai" | "import"; label: string; hint: string; icon: LucideIcon };
const MODES: ReadonlyArray<Mode> = [
  { key: "href", label: "A mano", hint: "Escribes el contenido en el editor.", icon: PenLine },
  { key: "ai", label: "Con IA", hint: "La IA local propone un borrador que revisas.", icon: Sparkles },
  { key: "import", label: "Importar", hint: "Desde un archivo (PDF, Word, Excel, imagen…) o un enlace.", icon: FileUp },
];

// `export default async function` (RSC): lee la sección elegida de la URL en el servidor
export default async function NewActivityPage(props: { searchParams: Promise<{ tab?: string; idioma?: string; nivel?: string }> }) {
  const sp = await props.searchParams;
  const tab = parseTab(sp.tab); // [Fail Fast]: valor desconocido → Práctica
  const create = ACTIVITY_TABS[tab].create;
  // [Validación]: solo idiomas y niveles conocidos llegan a la URL de los editores | `some` (ES5)
  const language = isLanguage(sp.idioma) ? sp.idioma : "";
  const level = LEVEL_OPTIONS.some((l) => l.value === sp.nivel) ? sp.nivel! : "";
  const needsLang = tab !== "polyglot"; // Poliglota muestra el tema en los siete idiomas a la vez
  const ready = !needsLang || Boolean(language && level);
  const keep = { ...(language ? { idioma: language } : {}), ...(level ? { nivel: level } : {}) }; // Se conservan al cambiar de sección
  const withLang = (href: string) => (language && level ? `${href}${href.includes("?") ? "&" : "?"}idioma=${language}&nivel=${level}` : href);

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href={`/admin/activities?tab=${tab}`} memo="activities">Volver a actividades</BackLink>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Crear actividad</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tres pasos: idioma y nivel, qué vas a crear y cómo. Se guarda como borrador hasta que se publique.</p>
      </header>

      {/* ── Paso 1: idioma y nivel (como «Crear recurso») ── */}
      <Step n={1} title="¿Para qué idioma y nivel?" hint={needsLang ? "El editor se abre con este idioma y nivel ya elegidos." : "Poliglota muestra el tema en los siete idiomas; el idioma no hace falta."}>
        <Suspense fallback={null}>
          <ActivityLangLevel language={language} level={level} />
        </Suspense>
      </Step>

      {/* ── Paso 1: tipo (mismas tarjetas que «¿Qué vas a crear?» de Recursos) ── */}
      <Step n={2} title="¿Qué vas a crear?">
        <nav aria-labelledby="step-2" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ACTIVITY_TAB_KEYS.filter((k) => ACTIVITY_TABS[k].create).map((k) => {
            const def = ACTIVITY_TABS[k];
            const Icon = def.icon;
            const active = k === tab;
            return (
              // `scroll={false}` (next/link): cambiar de tarjeta no salta al inicio de la página
              <Link
                key={k}
                href={{ pathname: "/admin/activities/new", query: { tab: k, ...keep } }}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex gap-3 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-primary bg-tone-brand-soft shadow-sm" : "border-border bg-card hover:border-primary/60",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-tone-brand-soft text-tone-brand">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-bold", active && "text-tone-brand")}>{def.label}</span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">{def.description}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </Step>

      {/* ── Paso 2: cómo (solo los caminos que la sección admite) ── */}
      <Step n={3} title="¿Cómo la vas a crear?" hint={ready ? `${ACTIVITY_TABS[tab].label}: al guardar vuelves a esta pestaña de Gestión.` : "Primero elige idioma y nivel en el paso 1."}>
        <ul className="grid gap-2 sm:grid-cols-3">
          {MODES.filter((m) => create?.[m.key]).map((m) => (
            <li key={m.key}>
              {/* `withReturn`: ?volver=/admin/activities?tab=… → el editor Angular regresa a la pestaña */}
              {/* [2026-10-24]: sin idioma y nivel el enlace queda inactivo (aria-disabled + sin href) → no se abre el editor a medias */}
              <a
                href={ready ? withReturn(withLang(create![m.key]!), tab) : undefined}
                aria-disabled={!ready || undefined}
                className={cn("flex h-full gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", !ready && "pointer-events-none opacity-50")}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-tone-brand-soft text-tone-brand">
                  <m.icon aria-hidden className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{m.key === "href" ? create!.label : m.label}</span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">{m.hint}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Step>
    </div>
  );
}
