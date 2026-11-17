// [Markdown · 2026-10-23]: render MÍNIMO y seguro del Markdown que generan la IA y la importación (títulos, viñetas, listas numeradas, párrafos y **negrita**) | sin dangerouslySetInnerHTML → React escapa todo el texto (sin XSS)
// [Patrón]: Interpreter (línea → bloque) + Presentational | [Principio]: KISS + YAGNI (sin librería: solo la sintaxis que producimos) | [Paradigma]: Funcional (puro, sirve en RSC y Client)
// ponytail: no soporta tablas, enlaces ni código; si se necesitan, usar `marked` + DOMPurify (ya en Angular)
import type { ReactNode } from "react";
import { youtubeEmbed } from "@/lib/youtube";
import { detectLanguage, splitByLanguage } from "@/lib/lang-detect";

// [inline]: **negrita** → <strong> | `split` con grupo de captura conserva los delimitados en índices impares
// [lang · 2026-10-30]: con idioma de curso, lo escrito en ese idioma se colorea y cada palabra se puede pulsar (data-word → diccionario global, WordDictionary) | el resto queda como texto normal
const foreign = (text: string, lang?: string): ReactNode => {
  if (!lang || lang === "es") return text;
  const chunks = splitByLanguage(text, lang);
  return chunks.map((c, i) => {
    const part = text.slice(c.start, c.end);
    // [Ejemplo · 2026-10-30]: «Dogs bark. (Los perros ladran.)» → lo que precede a una traducción entre paréntesis ES del idioma del curso aunque no tenga palabras reconocibles
    const next = chunks[i + 1];
    const beforeTranslation = part.trimEnd().endsWith("(") && next !== undefined && next.lang === "es";
    // Estricto: `detectLanguage` debe RECONOCER el idioma (un trozo indeciso como «Uso» no se colorea; para la voz sí cuenta, aquí no) | `split` con grupo conserva separadores | `\p{L}` (Unicode): cualquier alfabeto
    return beforeTranslation || detectLanguage(part, [lang, "es"]) === lang ? (
      <span key={i} lang={lang} className="font-medium text-tone-brand">
        {part.split(/(\p{L}[\p{L}'’-]*)/u).map((w, j) => (j % 2 ? <span key={j} data-dict-word className="cursor-pointer rounded-sm hover:bg-tone-brand-soft">{w}</span> : w))}
      </span>
    ) : (
      part
    );
  });
};
const inline = (text: string, lang?: string): ReactNode[] => text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{foreign(part, lang)}</strong> : <span key={i}>{foreign(part, lang)}</span>));

type Block = { kind: "h" | "p" | "ul" | "ol"; lines: string[]; level?: number };

// [Ejemplos · 2026-10-30]: «frase (traducción)» SIEMPRE en su propia línea y sin repetir, aunque la IA los escriba seguidos o sin viñetas (antes un párrafo «revuelto») | [Patrón]: Normalizer | [Paradigma]: Funcional (RegExp pura)
const EXAMPLE = /^[^()]+\([^()]+\)[.!?]?$/; // `[^()]`: sin paréntesis anidados
const EXAMPLES_LABEL = /^(?:\*\*)?(?:ejemplos?|examples?)(?::\*\*|\*\*:?|:)\s*/i; // «**Ejemplos**», «Ejemplos:», «**Ejemplos:**»
// `(?<=…)` (lookbehind ES2018): corta tras «)» sin perderlo | `(?=[\p{Lu}¿¡])`: solo si empieza otra frase
const splitExamples = (line: string) => line.split(/(?<=\)[.!?]?)\s+(?=[\p{Lu}¿¡])/u);
function examplesOf(b: Block): Block[] {
  if (b.kind !== "p") return [b];
  const label = EXAMPLES_LABEL.exec(b.lines[0]!);
  const rest = label ? [b.lines[0]!.slice(label[0].length), ...b.lines.slice(1)].filter(Boolean) : b.lines;
  const items = rest.flatMap(splitExamples);
  // Sin etiqueta se exigen 2 o más: un único «texto (aclaración)» es un párrafo normal
  if (!items.length || (!label && items.length < 2) || !items.every((x) => EXAMPLE.test(x))) return [b];
  return [...(label ? [{ kind: "p" as const, lines: [`**${label[0].replace(/[*:\s]/g, "")}**`] }] : []), { kind: "ul" as const, lines: items }];
}

// [parse]: agrupa líneas consecutivas del mismo tipo de lista en un bloque | `reduce` (ES5) | [Paradigma]: Funcional
function parse(md: string): Block[] {
  return md.split(/\r?\n/).reduce<Block[]>((blocks, raw) => {
    const line = raw.trim();
    const last = blocks.at(-1); // `at(-1)` (ES2022): último elemento
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (!line) blocks.push({ kind: "p", lines: [] }); // Línea vacía: corta el bloque actual
    else if (h) blocks.push({ kind: "h", lines: [h[2]!], level: h[1]!.length });
    else if (ul) last?.kind === "ul" ? last.lines.push(ul[1]!) : blocks.push({ kind: "ul", lines: [ul[1]!] });
    else if (ol) last?.kind === "ol" ? last.lines.push(ol[1]!) : blocks.push({ kind: "ol", lines: [ol[1]!] });
    else last?.kind === "p" ? last.lines.push(line) : blocks.push({ kind: "p", lines: [line] });
    return blocks;
  }, []).filter((b) => b.lines.length).flatMap(examplesOf);
}

export function Markdown({ text, className = "", lang }: { text: string; className?: string; lang?: string }) {
  return (
    // `data-dict-lang` (atributo data-*): idioma del contenido → seleccionar una palabra suelta dentro de una explicación en español también abre el diccionario (WordDictionary)
    <div className={`space-y-2 ${className}`} data-dict-lang={lang && lang !== "es" ? lang : undefined}>
      {parse(text).map((b, i) =>
        b.kind === "h" ? (
          // [Semántica]: ## → <h3> (la página ya tiene h1/h2) | [SEO + a11y]: jerarquía de títulos coherente
          // [Tipografía uniforme · 2026-10-28]: `title-card` (escala de @aula/ui-tokens) para # y ## → mismo título que el resto de tarjetas del portal
          <h3 key={i} className="title-card">{inline(b.lines[0]!)}</h3>
        ) : b.kind === "ul" ? (
          // `new Set` (ES2015): la IA repite viñetas idénticas (el mismo ejemplo dos veces) → se muestra una
          <ul key={i} className="list-disc space-y-1 pl-5">{[...new Set(b.lines)].map((l, j) => <li key={j}>{inline(l, lang)}</li>)}</ul>
        ) : b.kind === "ol" ? (
          <ol key={i} className="list-decimal space-y-1 pl-5">{[...new Set(b.lines)].map((l, j) => <li key={j}>{inline(l, lang)}</li>)}</ol>
        ) : b.lines.length === 1 && youtubeEmbed(b.lines[0]) ? (
          // [2026-10-25]: un párrafo que es SOLO un enlace de YouTube → video incrustado (cursos importados/compartidos)
          <iframe key={i} src={youtubeEmbed(b.lines[0])!} title="Video de YouTube" className="aspect-video w-full max-w-2xl rounded-lg" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <p key={i}>{inline(b.lines.join(" "), lang)}</p>
        ),
      )}
    </div>
  );
}
