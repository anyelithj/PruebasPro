import { SpeakButton } from "@/components/curriculum/SpeakButton";
import { IpaTextHost } from "@/components/language/IpaTextHost"; // [2026-10-28]: IPA + traducción calculadas (<aula-ipa-text>, caché compartida) cuando el contenido no las trae guardadas
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
import { ITEM_TYPE_OPTIONS, type PracticeItem } from "@/lib/activity-kinds";
import type { ActivityTab } from "@/lib/activities-api";
import { languageLabel } from "@/lib/languages";
import type { ReadingTextDetail } from "@/lib/reading";
import { Pencil } from "lucide-react"; // [2026-11-16]: «Editar» por fila como icono
// [ActivityPreview · 2026-10-27]: «Así lo verá el estudiante» en la página de revisión de Gestión → Actividades — en Next.js (antes un <iframe> con la
// pantalla del remoto Angular COMPLETA: su propio menú y cabecera dentro de la página → parecía otra aplicación)
// Diálogos, Práctica, Lectura, Poliglota y juegos con material propio se pintan aquí con sus datos (IPA, traducción, ítems) · Música sigue con su reproductor
// Angular embebido, pero en «modo incrustado» (sin menú ni cabecera: AppComponent detecta el iframe) | [Patrón]: Container (RSC) + Strategy por sección | [Principio]: SRP + DRY (SpeakButton de Recursos)
// [A11y]: listas semánticas, `lang` en el texto del idioma estudiado y `lang="xx-fonipa"` en el IPA (no se lee como texto)

type Turn = { id: string; speaker: "A" | "B"; text: string; ipa: string | null; translation: string | null };
type DialogueDetail = { language: string; speakers?: string[]; turns: Turn[]; hasAudio?: boolean };
type PracticeDetail = { language: string; description?: string; items: Array<PracticeItem & { id: string }> };
type DeckDetail = { language: string; items: Array<{ term: string; translation?: string; emoji?: string }> };
// `Record<K, V>` (TS): una celda por idioma | `null` = hueco, el término aún no existe
type PolyglotTable = { languages: string[]; rows: Array<{ concept: { id: string; emoji: string; gloss: string; imageUrl?: string | null }; terms: Record<string, { text: string; ipa: string; needsNativeReview: boolean } | null> }> };

const ITEM_LABEL = Object.fromEntries(ITEM_TYPE_OPTIONS.map((o) => [o.value, o.label])) as Record<string, string>; // `Object.fromEntries` (ES2019): Lookup Table
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// [ARTICLES · 2026-11-09]: artículos que encabezan sustantivos (mismo criterio que <aula-ipa-label> en Angular)
const ARTICLES: Record<string, ReadonlySet<string>> = {
  de: new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"]),
  fr: new Set(["le", "la", "les", "un", "une", "des"]),
  pt: new Set(["o", "a", "os", "as", "um", "uma"]),
  es: new Set(["el", "la", "los", "las", "un", "una"]),
};

// [Ipa]: transcripción con su idioma fonético | con artículo («der Hund») → /deːɐ̯/ en otro color + /ˈhʊnt/ | componente interno
const Ipa = ({ ipa, lang, text }: { ipa: string | null | undefined; lang: string; text?: string }) => {
  if (!ipa) return <span className="text-[11px] italic text-tone-warning">IPA pendiente</span>;
  const clean = ipa.replace(/^\/|\/$/g, "").trim();
  const tokens = clean.split(/\s+/);
  const first = (text ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const art = tokens.length > 1 && ARTICLES[lang]?.has(first);
  return (
    <span lang={`${lang}-fonipa`} className="font-mono text-xs text-muted-foreground">
      {art ? <><span className="text-tone-info" title="Artículo">/{tokens[0]}/</span> /{tokens.slice(1).join(" ")}/</> : `/${clean}/`}
    </span>
  );
};

// [SAY_PROMPT · 2026-10-28]: tipos de ítem cuyo enunciado se pronuncia · «ordenar» (instrucción + fichas) y «marcar errores» (errores a propósito) se muestran tal cual | `ReadonlySet` (TS)
const SAY_PROMPT: ReadonlySet<string> = new Set(["multiple_choice", "fill_blank", "match_pairs", "open_answer"]);

// [spokenOf · 2026-10-28]: texto que se pronuncia y se consulta — los huecos «___» se leen como pausa («…») | Función pura
const spokenOf = (text: string): string => text.replace(/_{3,}/g, "…").trim();

// [Said · 2026-10-28]: UNA línea del idioma estudiado como la ve el estudiante → texto + botón de sonido (SpeakButton: audio del servidor o voz del navegador)
// + IPA (la guardada o, si falta, la calculada) + traducción al español (la guardada o la calculada) | [Patrón]: Presentational + Graceful Degradation | [Principio]: DRY (diálogos, práctica, lectura y juegos pintan igual)
// `translation === undefined` = el contenido no guarda traducción → la calcula <aula-ipa-text> · `null`/"" = pendiente (la IA la completa en segundo plano)
function Said({ text, lang, ipa, translation, strong = true }: { text: string; lang: string; ipa?: string | null; translation?: string | null; strong?: boolean }) {
  const spoken = spokenOf(text);
  const foreign = lang !== "es"; // En español no hay traducción que mostrar
  const computeTranslation = foreign && !ipa && translation === undefined; // Solo cuando la ficha calcula también el IPA (una consulta por línea)
  return (
    <div className="min-w-0 space-y-0.5">
      <p className={`flex items-start gap-2 ${strong ? "font-medium" : ""}`} lang={lang}>
        <span className="min-w-0 flex-1 whitespace-pre-line break-words">{text}</span>
        {spoken && <SpeakButton text={spoken} lang={lang} label={`Escuchar «${spoken}»`} />}
      </p>
      {/* IPA guardada → se muestra · sin IPA → <aula-ipa-text ipa-only> la calcula (y la traducción si el contenido no la guarda) */}
      {ipa ? (
        <Ipa ipa={ipa} lang={lang} text={text} />
      ) : (
        <span className="block text-xs">
          <IpaTextHost text={spoken} language={lang} ipaOnly withSwitch={false} withTranslation={computeTranslation} fallback={<Ipa ipa={null} lang={lang} />} />
        </span>
      )}
      {foreign && !computeTranslation && translation !== undefined && (
        <p className="text-muted-foreground" lang="es">
          {translation || <span className="italic text-tone-warning">Traducción pendiente</span>}
        </p>
      )}
    </div>
  );
}

// [Pending]: aviso cuando la IA aún está completando IPA/traducción (se genera en segundo plano tras crear)
const Pending = ({ n }: { n: number }) =>
  n > 0 ? (
    <p role="status" className="rounded-lg border border-tone-info-line bg-tone-info-soft px-3 py-2 type-meta text-tone-info">
      {n} línea(s) sin IPA o traducción todavía: la IA las completa en segundo plano. Recarga la página en unos segundos.
    </p>
  ) : null;

// `export async function` (RSC): carga los datos con el token del servidor | nunca rompe la página: sin datos → iframe de respaldo
export async function ActivityPreview({ tab, id, viewHref, title }: { tab: ActivityTab; id: string; viewHref: string; title: string }) {
  const bearer = (await getCurrentAccessToken()) ?? undefined;
  const get = <T,>(path: string) => apiFetch<T>(path, { bearer }).catch(() => null); // `.catch(() => null)`: degradación elegante

  if (tab === "dialogues") {
    const d = await get<DialogueDetail>(`/dialogues/${encodeURIComponent(id)}`);
    if (d) {
      const pending = d.turns.filter((t) => !t.ipa || (d.language !== "es" && !t.translation)).length;
      return (
        <div className="space-y-3">
          <Pending n={pending} />
          <ol aria-label="Turnos del diálogo" className="space-y-2">
            {d.turns.map((t) => (
              <li key={t.id} className={`flex flex-col gap-1 rounded-xl border border-border p-3 ${t.speaker === "B" ? "bg-muted/40 sm:ml-10" : "bg-card sm:mr-10"}`}>
                <span className="text-[11px] font-bold uppercase tracking-wide text-tone-brand">{d.speakers?.[t.speaker === "B" ? 1 : 0] ?? t.speaker}</span>
                <Said text={t.text} lang={d.language} ipa={t.ipa} translation={t.translation ?? null} />
              </li>
            ))}
          </ol>
        </div>
      );
    }
  }

  if (tab === "practice") {
    const a = await get<PracticeDetail>(`/practice/activities/${encodeURIComponent(id)}`);
    if (a) {
      return (
        <div className="space-y-3">
          {a.description && <p className="text-muted-foreground">{a.description}</p>}
          <ol aria-label="Ítems de la actividad" className="space-y-2">
            {a.items.map((it, i) => (
              <li key={it.id} className="space-y-1 surface p-3">
                <p className="type-meta font-bold uppercase tracking-wide text-tone-brand">
                  {i + 1}. {ITEM_LABEL[it.itemType] ?? it.itemType}
                </p>
                {/* [2026-10-28]: enunciado con sonido, IPA y traducción (la práctica no guarda IPA → la calcula <aula-ipa-text>) · mismo criterio que el reproductor Angular (SAY_PROMPT) */}
                {SAY_PROMPT.has(it.itemType) ? (
                  <Said text={it.prompt} lang={a.language} />
                ) : (
                  <p className="whitespace-pre-line font-medium" lang={a.language}>
                    {it.prompt}
                  </p>
                )}
                {it.options?.length > 0 && (
                  // [Opciones]: en «emparejar» la derecha suele ser la traducción → sin IPA ni sonido del idioma estudiado
                  <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Opciones">
                    {it.options.map((o) => (
                      <li key={o} className="rounded-lg bg-muted px-2.5 py-1.5 text-foreground">
                        {it.itemType === "match_pairs" ? <span>{o}</span> : <Said text={o} lang={a.language} strong={false} />}
                      </li>
                    ))}
                  </ul>
                )}
                {it.accepted?.length > 0 && (
                  <p className="type-meta text-tone-brand">
                    <b>Respuesta:</b> {it.accepted.map((v) => v.join(" / ")).join(" · ")}
                  </p>
                )}
                {it.explanation && <p className="type-meta text-muted-foreground">{it.explanation}</p>}
              </li>
            ))}
          </ol>
        </div>
      );
    }
  }

  if (tab === "reading") {
    const r = await get<ReadingTextDetail>(`/reading/texts/${encodeURIComponent(id)}`);
    if (r) {
      return (
        <div className="space-y-3">
          <Pending n={r.pending} />
          <ol aria-label="Frases de la lectura" className="space-y-2">
            {r.sentences.map((s) => (
              <li key={s.id} className="space-y-0.5 rounded-lg border border-border bg-card px-3 py-2">
                <Said text={s.text} lang={r.language} ipa={s.ipa} translation={s.translation ?? null} strong={false} />
              </li>
            ))}
          </ol>
        </div>
      );
    }
  }

  // [Fix 2026-10-31 · Poliglota]: antes un <iframe> de /poliglota → la pantalla completa (temas, idiomas, comparaciones) con el PRIMER tema, no el de esta actividad
  // [Semántica + A11y]: <table> con <caption> y `scope` | [Responsive]: `overflow-x-auto` y primera columna `sticky`; `tabIndex={0}` permite desplazarla con el teclado
  if (tab === "polyglot") {
    const table = await get<PolyglotTable>(`/polyglot/table?topic=${encodeURIComponent(id)}`);
    if (table) {
      if (!table.rows.length) return <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">Este tema aún no tiene palabras. Pulsa «Editar» para añadirlas.</p>;
      // `flatMap` (ES2019): celdas de todas las filas → cuántas siguen sin IPA
      const pending = table.rows.flatMap((r) => table.languages.map((l) => r.terms[l])).filter((c) => c && !c.ipa).length;
      return (
        <div className="space-y-3">
          <Pending n={pending} />
          {/* [2026-11-03]: scroll VERTICAL además del horizontal (máx. 65 % de la pantalla) con cabecera fija → tablas largas sin perder los idiomas */}
          <div role="region" tabIndex={0} aria-label={`Tabla comparativa de ${title}`} className="max-h-[65vh] overflow-auto rounded-xl border border-border">
            <table className="w-full min-w-[56rem] border-collapse text-left">
              <caption className="sr-only">Vocabulario de {title} en cada idioma, con IPA y sonido</caption>
              <thead className="sticky top-0 z-20 bg-muted">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-muted p-3">Concepto</th>
                  <th scope="col" className="p-3"><span className="sr-only">Acciones</span></th>
                  {table.languages.map((l) => (
                    <th key={l} scope="col" className="p-3">{languageLabel(l)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map(({ concept, terms }) => (
                  <tr key={concept.id} className="border-t border-border align-top">
                    <th scope="row" className="sticky left-0 z-10 bg-card p-3 font-medium">
                      {/* eslint-disable-next-line @next/next/no-img-element -- data URL o enlace del docente */}
                      {concept.imageUrl ? <img src={concept.imageUrl} alt="" className="mr-1 inline size-8 rounded object-cover" /> : concept.emoji && <span aria-hidden className="mr-1">{concept.emoji}</span>}
                      {concept.gloss}
                    </th>
                    {/* [2026-11-03]: «Editar» por fila → editor de Políglota abierto en ESTE concepto (#concept-<id>) */}
                    <td className="p-3">
                      <a href={`/admin/activities/editar/polyglot/${encodeURIComponent(id)}#row-${concept.id}`} className="btn btn-outline btn-sm size-8 px-0!" aria-label={`Editar «${concept.gloss}»`} title="Editar">
                        {/* [2026-11-16]: icono en vez de texto (mismo criterio que las tarjetas de Recursos) */}
                        <Pencil aria-hidden className="size-4" />
                      </a>
                    </td>
                    {table.languages.map((l) => {
                      const cell = terms[l];
                      return (
                        <td key={l} className="p-3">
                          {cell ? <Said text={cell.text} lang={l} ipa={cell.ipa} strong={false} /> : <span className="italic text-muted-foreground">Sin término</span>}
                          {cell?.needsNativeReview && <p className="mt-1 text-[11px] text-tone-warning">Pendiente de revisión por un hablante nativo</p>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
  }

  if (tab === "games" && UUID.test(id)) {
    const deck = await get<DeckDetail>(`/games/decks/${encodeURIComponent(id)}`);
    if (deck) {
      return (
        <ul aria-label="Palabras del juego" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {deck.items.map((w) => (
            <li key={w.term} className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2">
              {w.emoji && <span aria-hidden>{w.emoji}</span>}
              {/* [2026-10-28]: palabra con sonido, IPA calculada y traducción (la del mazo o, si falta, la calculada) */}
              <Said text={w.term} lang={deck.language} translation={w.translation || undefined} />
            </li>
          ))}
        </ul>
      );
    }
  }

  // [Respaldo]: reproductor del estudiante (Angular) en modo incrustado — sin menú ni cabecera del portal (AppComponent lo detecta) | mismo origen
  return <iframe src={viewHref} title={`Vista previa: ${title}`} className="h-[75vh] w-full rounded-xl border border-border bg-card" />;
}
