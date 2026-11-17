import { Lightbulb, MessageCircle, Puzzle, Volume1, type LucideIcon } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import type { ReactNode } from "react";
import { MouthMedia } from "@/components/curriculum/MouthMedia"; // [2026-11-14]: imagen o video de la boca en «Cómo se pronuncia»
import {
  EXERCISE_TYPE_LABEL,
  withArticle,
  type ContentByKind,
  type VisualFields,
  type CurriculumItemKind,
  type ExampleValue,
  type IpaValue,
} from "@/types/curriculum";
import { ARTICLE_IPA_COLOR, splitArticleIpa } from "@aula/shared-schemas"; // [2026-11-10]: IPA del artículo aparte y en otro color
import { SpeakButton } from "@/components/curriculum/SpeakButton"; // [Audio]: pronunciación con la voz del navegador (única pieza cliente)
import { IpaTextHost } from "@/components/language/IpaTextHost"; // [Sprint 8.4]: IPA automático UK/US cuando la ficha no trae transcripción
import { WordLookupHost } from "@/components/language/WordLookupHost"; // [Sprint 10.4]: diccionario al pulsar una palabra de los ejemplos
// [ResourcePreview]: muestra el CONTENIDO de un recurso como lo verá el estudiante (ficha de palabra, regla, ejercicio…) | [Patrón]: Strategy (un renderizador por tipo) + Registry | [Principio]: OCP (nuevo tipo = nueva entrada) + SRP | [Paradigma]: Funcional + Declarativo
// [Tecnología]: componente sin estado ni hooks → funciona como Server Component (listado/detalle) y dentro de Client Components (vista previa en vivo del formulario)

// [Say]: botón de audio solo si se conoce el idioma (en el formulario y en /resources) | [Principio]: DRY
function Say({ text, lang, slow, variant }: { text?: string; lang?: string; slow?: boolean; variant?: string }) {
  if (!lang || !text) return null;
  return <SpeakButton text={text} lang={lang} slow={slow} variant={variant} label={`${slow ? "Escuchar despacio" : "Escuchar"} «${text}»`} />;
}

// [Ejemplos]: lista de frases con traducción | reutilizada por vocabulario y reglas | [Principio]: DRY
// `ruleWords` (2026-11-14): en pronunciación resalta solo las palabras del sonido (antes salían las marcas «aprender» del usuario, p. ej. «I», «some»)
function Examples({ items, lang, ruleWords }: { items?: ExampleValue[]; lang?: string; ruleWords?: string[] }) {
  if (!items?.length) return null; // `?.` (ES2020): tolera contenido antiguo sin ejemplos
  return (
    <ul className="mt-2 space-y-1 border-l-2 border-tone-brand-line pl-3 type-meta">
      {items.map((ex, i) => (
        <li key={i}>
          <Say text={ex.text} lang={lang} /> <WordLookupHost text={ex.text} language={lang} className="font-medium" ruleWords={ruleWords} />
          {ex.romanization && <span className="text-muted-foreground"> · {ex.romanization}</span>}
          {/* [IPA de la frase · 2026-10-23]: pronunciación escrita bajo cada ejemplo; si el ejemplo no trae traducción, también la traducción automática */}
          {ex.ipa ? (
            <span lang={`${lang ?? "en"}-fonipa`} className="block font-mono text-muted-foreground">/{ex.ipa}/</span>
          ) : (
            lang && lang !== "es" && (
              <span className="block">
                <IpaTextHost text={ex.text} language={lang} ipaOnly withTranslation={!ex.translationEs} />
              </span>
            )
          )}
          {ex.translationEs && <span className="block text-muted-foreground">{ex.translationEs}</span>}
        </li>
      ))}
    </ul>
  );
}

// [GrammarSection · 2026-10-23]: sección con icono, nombre y tono (espejo de <aula-grammar-section> de Angular) | `tone`: borde + fondo + texto de la paleta de marca
function GrammarSection({ icon: Icon, title, tone, children }: { icon: LucideIcon; title: string; tone: string; children: ReactNode }) {
  return (
    <section className={`overflow-hidden rounded-xl border bg-card ${tone.split(" ")[0]}`}>
      <h4 className={`flex items-center gap-1.5 border-b px-3 py-1.5 title-overline ${tone}`}>
        <Icon aria-hidden className="size-3.5" /> {title}
      </h4>
      <div className="px-3 py-2">{children}</div>
    </section>
  );
}

// [Ipa]: transcripción + variante regional (la variante siempre visible: no hay pronunciación "universal")
// [Legibilidad]: tamaño base, peso semibold y fondo suave → la pronunciación escrita destaca en la ficha | `lang="und-fonipa"` (BCP 47): el lector de pantalla la trata como transcripción fonética
// [2026-11-10]: «der Hund» → /deːɐ̯/ (color del artículo) + /ˈhʊnt/ en barras separadas (IA, importado o manual: se decide al mostrar)
function Ipa({ ipa, text, lang }: { ipa?: IpaValue; text?: string; lang?: string }) {
  if (!ipa?.value) return null;
  const parts = splitArticleIpa(ipa.value, text, lang ?? "");
  return (
    <span className="mt-1 inline-flex flex-wrap items-center gap-1.5">
      <span lang="und-fonipa" className="rounded-md bg-tone-brand-soft px-2 py-0.5 font-mono text-base font-semibold tracking-wide text-tone-brand">
        {parts ? (
          <>
            <span style={{ color: ARTICLE_IPA_COLOR }} title="Artículo">/{parts[0]}/</span> /{parts[1]}/
          </>
        ) : (
          ipa.value
        )}
      </span>
      <span className="badge bg-muted px-1.5 py-0 text-[10px] text-muted-foreground">{ipa.variant}</span>
    </span>
  );
}

// [EnIpa · 2026-10-23]: una sola regla de IPA para vocabulario y pronunciación | [Principio]: DRY | [Patrón]: Strategy por idioma
function EnIpa({ text, lang, ipa, shown }: { text: string; lang?: string; ipa?: IpaValue; shown?: string }) {
  if (lang === "en" || !ipa?.value)
    return (
      <span className="mt-1 block text-sm">
        <IpaTextHost text={text} language={lang ?? "en"} ipaOnly withSwitch fallback={<Ipa ipa={ipa} text={shown} lang={lang} />} />
      </span>
    );
  return <Ipa ipa={ipa} text={shown ?? text} lang={lang} />;
}

// [WordIpa · 2026-10-24]: IPA de una palabra de la ficha de fonema — la escrita por el docente/IA o, si falta, la calculada (espeak-ng vía IpaTextHost) | [Principio]: DRY (reutiliza EnIpa)
function WordIpa({ text, lang, ipa, variant }: { text: string; lang?: string; ipa?: string; variant?: string }) {
  const value = ipa?.trim() ? `/${ipa.trim().replace(/^\/|\/$/g, "")}/` : ""; // Barras normalizadas: «hɒt» y «/hɒt/» se ven igual
  return <EnIpa text={text} lang={lang} ipa={value ? { value, variant: variant ?? lang ?? "" } : undefined} />;
}

// `{ [K in Kind]: (c: ContentByKind[K]) => ReactNode }` (TS mapped type): cada renderizador recibe SU forma tipada | [Tipado seguro]
// `lang` (opcional): idioma del recurso → activa los botones de audio
const RENDERERS: { [K in CurriculumItemKind]: (c: ContentByKind[K], lang?: string, compact?: boolean) => ReactNode } = {
  vocabulary: (c, lang) => (
    <>
      {/* [Apoyo visual]: imagen adjunta o emoji (decorativos: la palabra ya está escrita debajo → alt vacío / aria-hidden) */}
      {c.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL pequeña embebida en el contenido (next/image no optimiza data URLs)
        <img src={c.image} alt="" loading="lazy" decoding="async" className="mb-2 aspect-square w-full max-w-40 rounded-xl object-cover" />
      ) : (
        c.emoji && (
          <span aria-hidden className="mb-1 block text-5xl leading-none">
            {c.emoji}
          </span>
        )
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* [Artículo · 2026-11-02]: «das Obst», «l'eau» junto al sustantivo (el audio sigue diciendo la palabra como antes) */}
        <span className="text-lg font-extrabold">{withArticle(lang ?? "", c.lemma, c.article)}</span>
        <Say text={c.lemma} lang={lang} variant={c.ipa?.variant} />
        <Say text={c.lemma} lang={lang} variant={c.ipa?.variant} slow />
        {c.gender && <span className="text-xs italic text-muted-foreground">{c.gender}</span>}
        {c.partOfSpeech && <span className="badge bg-muted text-muted-foreground">{c.partOfSpeech}</span>}
      </div>
      {/* [IPA · 2026-10-23]: en INGLÉS siempre UK/US con interruptor (antes, al traer IPA de la IA/importación o tras cambiar imagen/emoji, quedaba una sola variante sin interruptor) · otros idiomas: el del docente manda; si falta, <aula-ipa-text> lo calcula (espeak-ng) */}
      <EnIpa text={c.lemma} lang={lang} ipa={c.ipa} shown={withArticle(lang ?? "", c.lemma, c.article)} />
      {c.romanization && <p className="type-meta text-muted-foreground">{c.romanization}</p>}
      {/* [2026-11-05 · Regla de vocabulario]: plural y clasificador en la tarjeta → el sustantivo se estudia como unidad gramatical completa */}
      {(c.plural || c.classifier) && (
        <p className="type-meta text-muted-foreground">
          {c.plural && <>Plural: <span className="font-semibold text-foreground">{c.plural}</span></>}
          {c.classifier && <>Clasificador: <span lang="zh" className="font-semibold text-foreground">{c.classifier}</span></>}
        </p>
      )}
      <p className="mt-1">→ {c.translationEs}</p>
      <Examples items={c.examples} lang={lang} />
    </>
  ),
  // [Regla gramatical · 2026-10-23]: mismo diseño que las fichas de /gramatica (Angular) — portada con el degradado morado y secciones con icono y tono (uso, fórmula, ejemplos)
  // [A11y]: el color nunca va solo (icono + nombre de la sección) · WCAG 1.4.1
  grammar_rule: (c, lang) => (
    <article className="space-y-2.5">
      <header className="rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 px-3 py-2.5 text-white shadow-md shadow-primary/20">
        <p className="font-extrabold leading-tight">{c.title}</p>
      </header>
      {c.structure && (
        <GrammarSection icon={Puzzle} title="Fórmula" tone="border-tone-info-line bg-tone-info-soft text-tone-info">
          <p className="inline-block rounded-lg bg-muted px-2 py-1 font-mono type-meta font-semibold">{c.structure}</p>
        </GrammarSection>
      )}
      <GrammarSection icon={Lightbulb} title="Uso" tone="border-tone-brand-line bg-tone-brand-soft text-tone-brand">
        <p className="line-clamp-6 leading-relaxed">{c.explanationEs}</p>
      </GrammarSection>
      {c.examples?.length ? (
        <GrammarSection icon={MessageCircle} title="Ejemplos" tone="border-tone-warning-line bg-tone-warning-soft text-tone-warning">
          <Examples items={c.examples} lang={lang} />
        </GrammarSection>
      ) : null}
    </article>
  ),
  example: (c, lang) => (
    <>
      <p className="flex items-start gap-2 font-medium">
        <span>
          “<WordLookupHost text={c.text} language={lang} />”
        </span>{" "}
        <Say text={c.text} lang={lang} />
      </p>
      {c.romanization && <p className="type-meta text-muted-foreground">{c.romanization}</p>}
      {/* [IPA de la frase · 2026-10-23]: antes las frases no mostraban su pronunciación */}
      {lang && lang !== "es" && <IpaTextHost text={c.text} language={lang} ipaOnly withTranslation={!c.translationEs} />}
      {c.translationEs && <p className="mt-1 text-muted-foreground">{c.translationEs}</p>}
    </>
  ),
  translation: (c, lang) => (
    <dl className="grid gap-1 text-sm">
      <dt className="text-[11px] uppercase text-muted-foreground">Original</dt>
      <dd>
        {c.source} <Say text={c.source} lang={lang} />
      </dd>
      <dt className="text-[11px] uppercase text-muted-foreground">Español</dt>
      <dd>{c.targetEs}</dd>
      {c.notes && <dd className="type-meta text-muted-foreground">{c.notes}</dd>}
    </dl>
  ),
  // [Pronunciación · 2026-10-24]: ficha de FONEMA (p. ej. /ɒ/) → símbolo + botón para oírlo en la palabra clave, CUÁNDO se usa, CÓMO se pronuncia,
  // palabras con el sonido (cada una con audio, IPA y traducción) y frases donde se oye | sin fonema → la ficha de palabra/frase de siempre
  // [A11y]: cada bloque lleva icono + título (el color nunca va solo, WCAG 1.4.1) · `lang="…-fonipa"`: el lector de pantalla trata el símbolo como transcripción
  // [compact · 2026-11-16]: «Fichas del tema» de Gestión → sin el título grande (ya va en la cabecera de la tarjeta) y las explicaciones plegadas
  pronunciation: (c, lang, compact) => (
    <article className="space-y-2.5">
      {c.phoneme && !compact && (
        <header className="flex items-center gap-3 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 px-3 py-2.5 text-white shadow-md shadow-primary/20">
          <span lang="und-fonipa" className="font-mono text-3xl font-extrabold leading-none">/{c.phoneme}/</span>
          <span className="text-xs leading-snug text-white/90">Sonido de «{c.text}»: escúchalo con los botones de audio</span>
        </header>
      )}
      <p className={`flex items-center gap-2 ${compact ? "" : "type-lead font-extrabold"}`}>
        {!compact && c.text} <Say text={c.text} lang={lang} variant={c.ipa?.variant} /> <Say text={c.text} lang={lang} variant={c.ipa?.variant} slow />
      </p>
      <EnIpa text={c.text} lang={lang} ipa={c.ipa} />
      {c.romanization && <p className="type-meta text-muted-foreground">{c.romanization}</p>}
      {compact && (c.ruleEs || c.articulationEs || c.mouthMedia) ? (
        // `<details>` (HTML nativo): plegable accesible con teclado, sin JS
        <details className="rounded-lg border border-border px-3 py-1.5 text-sm">
          <summary className="cursor-pointer font-semibold text-muted-foreground">Cuándo se usa y cómo se pronuncia</summary>
          {c.ruleEs && <p className="mt-1.5 leading-relaxed">{c.ruleEs}</p>}
          {c.articulationEs && <p className="mt-1.5 leading-relaxed">{c.articulationEs}</p>}
          {c.mouthMedia && <MouthMedia mediaKey={c.mouthMedia} label={`Posición de la boca para «${c.text}»`} className="mt-2" />}
        </details>
      ) : null}
      {!compact && c.ruleEs && (
        <GrammarSection icon={Lightbulb} title="Cuándo se usa" tone="border-tone-brand-line bg-tone-brand-soft text-tone-brand">
          <p className="leading-relaxed">{c.ruleEs}</p>
        </GrammarSection>
      )}
      {!compact && (c.articulationEs || c.mouthMedia) && (
        <GrammarSection icon={Volume1} title="Cómo se pronuncia" tone="border-tone-info-line bg-tone-info-soft text-tone-info">
          {c.articulationEs && <p className="leading-relaxed">{c.articulationEs}</p>}
          {/* [2026-11-14]: imagen o video de la boca subido por el docente */}
          {c.mouthMedia && <MouthMedia mediaKey={c.mouthMedia} label={`Posición de la boca para «${c.text}»`} className="mt-2" />}
        </GrammarSection>
      )}
      {c.words?.length ? (
        <GrammarSection icon={Puzzle} title="Palabras con este sonido" tone="border-tone-warning-line bg-tone-warning-soft text-tone-warning">
          {/* `<ul>` semántico: cada palabra con audio normal/lento, IPA (la del docente o calculada) y traducción */}
          <ul className="space-y-1.5">
            {c.words.map((w, i) => (
              <li key={`${w.text}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-semibold">{w.text}</span>
                <Say text={w.text} lang={lang} variant={c.ipa?.variant} />
                <Say text={w.text} lang={lang} variant={c.ipa?.variant} slow />
                <WordIpa text={w.text} lang={lang} ipa={w.ipa} variant={c.ipa?.variant} />
                {w.translationEs && <span className="text-muted-foreground">· {w.translationEs}</span>}
              </li>
            ))}
          </ul>
        </GrammarSection>
      ) : null}
      {c.examples?.length ? (
        <GrammarSection icon={MessageCircle} title="Frases donde se oye" tone="border-border bg-muted text-foreground">
          <Examples items={c.examples} lang={lang} ruleWords={[...(c.words ?? []).map((w) => w.text), ...(c.phoneme ? [c.text] : [])]} />
        </GrammarSection>
      ) : null}
    </article>
  ),
  common_error: (c) => (
    <>
      {/* [Comparación ✗/✓]: el significado va también en el texto, no solo en el color (WCAG 1.4.1) */}
      <p className="text-tone-danger line-through decoration-2">✗ {c.incorrect}</p>
      <p className="font-semibold text-tone-brand">✓ {c.correct}</p>
      <p className="mt-1 line-clamp-3 type-meta text-muted-foreground">{c.explanationEs}</p>
    </>
  ),
  exercise: (c) => (
    <>
      <span className="badge bg-tone-info-soft text-tone-info">{EXERCISE_TYPE_LABEL[c.type] ?? c.type}</span>
      <p className="mt-1 font-medium">{c.prompt}</p>
      {c.type === "multiple_choice" && c.options?.length ? (
        <ul className="mt-1 space-y-0.5 type-meta">
          {/* [Clave estable · 2026-10-27]: dos opciones con el mismo texto («I like to play football.») repetían `key` → aviso de React y filas recicladas mal | posición + texto = única */}
          {c.options.map((o, i) => (
            <li key={`${i}-${o}`} className={c.answerKey.includes(o) ? "font-semibold text-tone-brand" : "text-muted-foreground"}>
              {c.answerKey.includes(o) ? "✓" : "○"} {o}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 type-meta text-tone-brand">
          ✓ {c.answerKey.map((a) => (a === "true" ? "Verdadero" : a === "false" ? "Falso" : a)).join(" · ")}
        </p>
      )}
    </>
  ),
  rubric: (c) => (
    <>
      <p className="font-bold">{c.title}</p>
      <ul className="mt-1 space-y-0.5 type-meta">
        {c.criteria.map((cr) => (
          <li key={cr.name} className="flex justify-between gap-2">
            <span>{cr.name}</span>
            <span className="eeg-mono text-muted-foreground">{cr.maxPoints} pts</span>
          </li>
        ))}
      </ul>
    </>
  ),
};

// `export function`: punto de entrada | `as never` (TS): el mapa garantiza la forma correcta; el contenido ya lo validó el backend
// `language` (opcional): idioma del recurso → botones 🔊 / 🐢 de pronunciación
export function ResourcePreview({ kind, content, language, compact }: { kind: CurriculumItemKind; content: Record<string, unknown>; language?: string; compact?: boolean }) {
  const render = RENDERERS[kind] as (c: never, lang?: string, compact?: boolean) => ReactNode;
  const { image, emoji } = content as VisualFields;
  return (
    <div className="min-w-0 break-words">
      {/* [Apoyo visual · 2026-10-30]: vocabulario lo pinta dentro de su ficha; el resto, aquí arriba | decorativo: el contenido ya está escrito (alt vacío / aria-hidden) */}
      {kind !== "vocabulary" && (image ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL pequeña embebida en el contenido (next/image no optimiza data URLs)
        <img src={image} alt="" loading="lazy" decoding="async" className="mb-2 aspect-square w-full max-w-40 rounded-xl object-cover" />
      ) : emoji ? (
        <span aria-hidden className="mb-1 block text-5xl leading-none">{emoji}</span>
      ) : null)}
      {render(content as never, language, compact)}
    </div>
  );
}
