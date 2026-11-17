import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeftRight, BookOpen, PenLine } from "lucide-react"; // Iconos SVG (decorativos: el título de cada bloque ya lo nombra)
import { SENTENCE_IPA } from "@/config/ipa-sentence-ipa";
import { SpeakButton } from "@/components/curriculum/SpeakButton"; // [Audio]: voz natural del sistema → espeak-ng → navegador
import { ResourcePreview } from "@/components/curriculum/ResourcePreview"; // [Reutilización]: MISMA ficha de pronunciación que en /resources/tema
import { IPA_CHARTS, type Phoneme, type PhonemeTopic } from "@/config/ipa-chart";
import { phonemeDetail, phonemeHref, type PhonemeDetail } from "@/config/ipa-phoneme-details";
import { languageLabel } from "@/lib/languages";
import type { PronunciationContent } from "@/types/curriculum";
import type { Language } from "@/types/quiz";
// [PhonemeSheet · 2026-11-14]: ficha de un FONEMA (símbolo, palabra clave con audio UK/US, explicación, palabras, frases, cómo se escribe,
// errores típicos, más sonidos y pares mínimos) — extraída de /resources/fonema para que Gestión → Currículo → tema de pronunciación
// se vea IGUAL (antes eran dos interfaces distintas) | [Patrón]: Presentational (RSC) + Slot (`items`: fichas del docente, con o sin acciones)
// [Principio]: DRY + SRP (los datos vienen de config/ y la ficha de ResourcePreview) | [SEO + a11y]: un <h1>, <section> con <h2>, `lang` en palabras e IPA

// [findInChart]: símbolo → su tema y fonema dentro del alfabeto del idioma | null si no existe | Función pura
export function findInChart(language: Language, symbol: string): { topic: PhonemeTopic; phoneme: Phoneme } | null {
  for (const topic of IPA_CHARTS[language]) {
    const phoneme = topic.phonemes.find((p) => p.symbol === symbol);
    if (phoneme) return { topic, phoneme };
  }
  return null;
}

// [asContent]: fonema + detalle → PronunciationContent para reutilizar ResourcePreview tal cual | Función pura | [Patrón]: Adapter
function asContent(p: Phoneme, detail: PhonemeDetail | null, variant: string): PronunciationContent {
  return {
    text: p.example,
    ipa: { value: `/${p.exampleIpa}/`, variant },
    phoneme: p.symbol,
    ruleEs: p.ruleEs,
    articulationEs: detail?.mouthEs,
    words: detail?.words.map(([text, ipa, translationEs]) => ({ text, ipa, translationEs })) ?? [{ text: p.example, ipa: p.exampleIpa }],
    examples: detail?.sentences.map(([text, translationEs]) => ({ text, translationEs, ipa: SENTENCE_IPA[text] })) ?? [], // [2026-11-02]: IPA precalculada
  };
}

// [Section]: bloque con icono + título (mismo lenguaje visual que las secciones de la ficha) | [Principio]: DRY
export function Section({ id, icon: Icon, title, children }: { id: string; icon: typeof BookOpen; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="surface space-y-3 p-4 sm:p-5">
      <h2 id={id} className="title-section flex items-center gap-2">
        <Icon aria-hidden className="size-4 text-tone-brand" /> {title}
      </h2>
      {children}
    </section>
  );
}

export interface PhonemeSheetProps {
  language: Language;
  topic: PhonemeTopic;
  phoneme: Phoneme;
  items?: ReactNode; // Fichas de los docentes (lista ya armada: el estudiante las ve; Gestión añade estado y acciones)
  itemsTitle?: string;
  actions?: ReactNode; // [Gestión]: descargar, editar, publicar y eliminar el tema (bajo el título)
  hideHeader?: boolean; // [2026-11-16]: Gestión pone su propia cabecera (DetailHeader, igual que los demás detalles) → aquí solo el cuerpo
}

export function PhonemeSheet({ language, topic, phoneme, items, itemsTitle = "Fichas de tus docentes", actions, hideHeader = false }: PhonemeSheetProps) {
  const detail = phonemeDetail(language, phoneme.symbol);
  const variant = language === "en" ? "en-GB" : language;
  const siblings = topic.phonemes.filter((p) => p.symbol !== phoneme.symbol); // [Vecinos]: otros sonidos del mismo tema

  return (
    <>
      {/* [Cabecera]: símbolo grande + tema + palabra clave con audio UK/US */}
      {!hideHeader && (
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span lang={`${language}-fonipa`} className="grid min-h-24 min-w-24 shrink-0 place-items-center self-start rounded-2xl bg-gradient-brand px-4 font-mono text-5xl font-extrabold text-white shadow-md shadow-primary/20">
          /{phoneme.symbol}/
        </span>
        <div className="min-w-0 space-y-1">
          <p className="type-meta font-semibold uppercase tracking-wide text-muted-foreground">
            {languageLabel(language)} · {topic.title}
          </p>
          <h1 className="title-page">
            Sonido <span lang={`${language}-fonipa`}>/{phoneme.symbol}/</span> como en <span lang={language} className="text-tone-brand">{phoneme.example}</span>
          </h1>
          <p className="text-muted-foreground">{topic.intro}</p>
          <p className="flex flex-wrap items-center gap-1.5 pt-1">
            <span lang={language} className="font-semibold">{phoneme.example}</span>
            <span lang={`${language}-fonipa`} className="font-mono text-xs text-muted-foreground">/{phoneme.exampleIpa}/</span>
            {language === "en" ? (
              <>
                <SpeakButton text={phoneme.example} lang="en" variant="en-GB" label={`Escuchar «${phoneme.example}» en acento británico`} />
                <span aria-hidden className="text-[10px] font-semibold text-muted-foreground">UK</span>
                <SpeakButton text={phoneme.example} lang="en" variant="en-US" label={`Escuchar «${phoneme.example}» en acento estadounidense`} />
                <span aria-hidden className="text-[10px] font-semibold text-muted-foreground">US</span>
              </>
            ) : (
              <SpeakButton text={phoneme.example} lang={language} label={`Escuchar «${phoneme.example}»`} />
            )}
          </p>
          {actions && <div className="flex flex-wrap items-center gap-2 pt-2">{actions}</div>}
        </div>
      </header>
      )}

      {/* [Responsive]: 1 columna en móvil · 3 en escritorio (ficha 2/3 + apoyos 1/3) */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section aria-label="Explicación, palabras y frases" className="surface p-4 sm:p-5" lang={language}>
            <ResourcePreview kind="pronunciation" content={asContent(phoneme, detail, variant) as unknown as Record<string, unknown>} language={language} />
          </section>

          {items && (
            <Section id="teacher-h" icon={BookOpen} title={itemsTitle}>
              {items}
            </Section>
          )}
        </div>

        <aside className="space-y-5" aria-label="Apoyos">
          <Section id="spell-h" icon={PenLine} title="Cómo se escribe">
            <p className="font-mono">{phoneme.spellings}</p>
          </Section>

          {detail && detail.mistakesEs.length > 0 && (
            <Section id="mistakes-h" icon={AlertTriangle} title="Errores frecuentes de hispanohablantes">
              <ul className="list-disc space-y-1.5 pl-5 leading-relaxed">
                {detail.mistakesEs.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </Section>
          )}

          {siblings.length > 0 && (
            <nav aria-labelledby="siblings-h" className="surface space-y-3 p-4 sm:p-5">
              <h2 id="siblings-h" className="title-section">Más sonidos: {topic.title}</h2>
              <ul className="flex flex-wrap gap-1.5">
                {siblings.map((s) => (
                  <li key={s.symbol}>
                    <Link href={phonemeHref(language, s.symbol)} className="chip" aria-label={`Sonido /${s.symbol}/ como en ${s.example}`}>
                      <span lang={`${language}-fonipa`} className="font-mono font-bold">/{s.symbol}/</span> <span lang={language}>{s.example}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          {/* [2026-11-02]: «Pares mínimos» DEBAJO de «Más sonidos» */}
          {detail && detail.pairs.length > 0 && (
            <Section id="pairs-h" icon={ArrowLeftRight} title="Pares mínimos: escucha la diferencia">
              <p className="type-meta text-muted-foreground">Palabras que solo cambian en este sonido. Escucha las dos y repítelas en voz alta.</p>
              {/* `overflow-x-auto`: la tabla nunca provoca scroll horizontal de la página en móvil */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Pares mínimos del sonido /{phoneme.symbol}/</caption>
                  <thead>
                    <tr className="text-left text-[11px] uppercase text-muted-foreground">
                      <th scope="col" className="px-2 py-1.5">Con /{phoneme.symbol}/</th>
                      <th scope="col" className="px-2 py-1.5">Contraste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.pairs.map(([a, aIpa, b, bIpa]) => (
                      <tr key={`${a}-${b}`} className="border-t border-border">
                        {[
                          [a, aIpa],
                          [b, bIpa],
                        ].map(([w, ipa]) => (
                          <td key={w} className="px-2 py-2">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span lang={language} className="font-semibold">{w}</span>
                              <span lang={`${language}-fonipa`} className="font-mono text-xs text-muted-foreground">/{ipa}/</span>
                              <SpeakButton text={w} lang={language} variant={variant} label={`Escuchar «${w}»`} />
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </aside>
      </div>
    </>
  );
}
