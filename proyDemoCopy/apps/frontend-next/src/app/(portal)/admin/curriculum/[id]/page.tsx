import { Sparkles, TriangleAlert } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurriculumItem, searchCurriculumSources } from "@/lib/curriculum-api";
import { getCurrentUserPayload } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { ApiError } from "@/lib/errors";
import { languageLabel } from "@/lib/languages";
import { CurriculumItemForm } from "@/components/curriculum/CurriculumItemForm";
import { ProvenanceBadge, StatusBadge } from "@/components/curriculum/CurriculumBadges";
import { ReviewStatusActions } from "@/components/curriculum/ReviewStatusActions";
import { ResourcePreview } from "@/components/curriculum/ResourcePreview";
import { GenerationTrace } from "@/components/curriculum/GenerationTrace";
import { CONTRADICTION_FLAG, KIND_META, PROVENANCE_LABEL, SKILL_LABEL } from "@/types/curriculum";
// [Página /admin/curriculum/:id]: detalle de un recurso — vista previa, estado de publicación, edición e historial | [Patrón]: Container (RSC) + Composite | [Principio]: SRP | [Tecnología]: Next.js Server Component

export const metadata: Metadata = {
  title: "Recurso",
  robots: { index: false, follow: false }, // Privada: no indexar | [SEO]
};

export const dynamic = "force-dynamic"; // Depende de la sesión → render por petición

// `as const` (TS): literales inmutables para el historial
const CHANGE_LABEL = { created: "Creado", updated: "Editado", status_changed: "Cambio de estado" } as const;

export default async function CurriculumItemPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  // [Guardia UUID]: rutas que no son un id (p. ej. `avatar-svg.component.css.map` que pide el navegador por los source maps de Angular) → 404 sin llamar a la API | `RegExp.test` (JS)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  let view;
  try {
    view = await getCurriculumItem(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound(); // `notFound()` (Next.js): renderiza la página 404
    throw err; // Otros errores → error boundary de la ruta
  }
  const { item, revisions = [], generation = null } = view; // Default en desestructuración (ES2015)
  // [¿Editado por una persona?]: el contenido guardado difiere del que propuso la IA | `JSON.stringify` (JS): comparación estructural simple (ambos normalizados por el mismo esquema)
  const humanEdited = generation ? JSON.stringify(generation.content) !== JSON.stringify(item.content) : undefined;
  // [Precarga en paralelo]: rol, "Contenido propio" y la fuente actual del recurso | `Promise.all` (ES2015)
  const [user, ownList, currentList] = await Promise.all([
    getCurrentUserPayload(),
    searchCurriculumSources({ limit: 1 }).catch(() => []),
    item.sourceId && item.source ? searchCurriculumSources({ search: item.source, limit: 10 }).catch(() => []) : Promise.resolve([]),
  ]);
  const ownSource = ownList.find((s) => s.isOwnContent) ?? null;
  const initialSource = currentList.find((s) => s.id === item.sourceId) ?? null;
  const meta = KIND_META[item.kind];
  const ipaVariant = (item.content.ipa as { variant?: string } | undefined)?.variant; // `?.` (ES2020): solo tipos con IPA

  return (
    // [Semántica]: <div> (el layout del portal ya aporta el <main>)
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/curriculum" memo="content">Volver a recursos</BackLink>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            <span aria-hidden>{meta.icon}</span> {meta.label} · {languageLabel(item.language)} · {item.level} · {SKILL_LABEL[item.skill]}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{item.topic}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={item.reviewStatus} />
            <ProvenanceBadge provenance={item.provenance} />
            <span className="font-mono text-[11px] text-muted-foreground">
              {item.key} · v{item.version}
            </span>
          </div>
        </div>
      </header>

      {/* [Vista previa + estado]: lo primero que se ve es CÓMO queda el recurso y en qué punto del flujo está */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface p-5" aria-labelledby="preview-title">
          <h2 id="preview-title" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Así lo verá el estudiante
          </h2>
          {/* [Aviso de mezcla de idiomas]: datos creados antes de la regla de coherencia (p. ej. "Francés" con IPA en-GB) → se señalan para corregirlos */}
          {ipaVariant && !ipaVariant.toLowerCase().startsWith(item.language) && (
            <p role="alert" className="mb-3 rounded-lg border border-tone-danger-line bg-tone-danger-soft px-3 py-2 text-xs text-tone-danger">
              <TriangleAlert aria-hidden className="inline size-4 align-[-0.125em]" /> Este recurso es de {languageLabel(item.language)} pero su pronunciación es «{ipaVariant}». Corrige el contenido abajo o usa «<Sparkles aria-hidden className="inline size-4 align-[-0.125em]" /> Generar con IA».
            </p>
          )}
          <ResourcePreview kind={item.kind} content={item.content} language={item.language} />
        </section>

        <section className="surface space-y-3 p-5" aria-labelledby="review-title">
          <h2 id="review-title" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Estado de publicación
          </h2>
          {/* [Comentario del revisor]: visible y destacado cuando existe (antes era "Nota: …" suelta) */}
          {/* [Etapa 4]: otra fuente dice algo incompatible → el revisor lo ve antes de aprobar | `role="alert"`: se anuncia al cargar */}
          {item.flags?.includes(CONTRADICTION_FLAG) && (
            <p role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft px-3 py-2 text-sm text-tone-danger">
              <b>Contradicción entre fuentes:</b> otra fuente registra un valor incompatible para este elemento. Contrástalo antes de publicarlo.
            </p>
          )}
          {item.reviewNote && (
            <p className="rounded-lg border border-tone-warning-line bg-tone-warning-soft px-3 py-2 text-sm text-tone-warning">
              <b>Comentario del revisor:</b> {item.reviewNote}
            </p>
          )}
          <ReviewStatusActions id={item.id} status={item.reviewStatus} version={item.version} />
        </section>
      </div>

      <section aria-labelledby="edit-title" className="space-y-3">
        <h2 id="edit-title" className="text-lg font-bold">
          Editar recurso
        </h2>
        {/* `key={item.version}` (React): reinicia el estado del formulario cuando llega una versión nueva */}
        <CurriculumItemForm key={item.version} initial={item} canAdmin={user?.role === Role.ADMIN} ownSource={ownSource} initialSource={initialSource} />
      </section>

      {/* [Trazabilidad]: procedencia + traza de la IA (modelo, tokens, latencia, memoria, banderas) — nada se presenta como verificado sin revisión */}
      <section className="surface space-y-3 p-5" aria-labelledby="trace-title">
        <h2 id="trace-title" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Trazabilidad
        </h2>
        <p className="text-xs">
          Procedencia: <b>{PROVENANCE_LABEL[item.provenance]}</b> · Fuente: <b>{item.source ?? "Contenido propio"}</b> · Versión {item.version} · Creado {new Date(item.createdAt).toLocaleDateString("es")}
        </p>
        {generation ? (
          <GenerationTrace trace={generation} humanEdited={humanEdited} />
        ) : (
          <p className="text-xs text-muted-foreground">
            {item.provenance === "generated" ? "Generado por IA antes de que existiera el registro de trazas (sin métricas disponibles)." : "Contenido sin intervención de IA (LLM_REQUIRED = false)."}
          </p>
        )}
      </section>

      <details className="surface p-5">
        <summary className="cursor-pointer text-base font-bold">Historial de cambios ({revisions.length})</summary>
        {revisions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Sin historial disponible.</p>
        ) : (
          <ol className="mt-3 space-y-2 text-sm">
            {revisions.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-3 border-b border-border pb-2 last:border-0">
                <span className="font-semibold">v{r.version}</span>
                <span>{CHANGE_LABEL[r.changeType]}</span>
                <time dateTime={r.createdAt} className="text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString("es")}
                </time>
                {r.note && <span className="text-muted-foreground">— {r.note}</span>}
              </li>
            ))}
          </ol>
        )}
      </details>
    </div>
  );
}
