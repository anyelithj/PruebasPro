// [Markdown · 2026-10-23]: render MÍNIMO y seguro del Markdown que generan la IA y la importación (títulos, viñetas, listas numeradas, párrafos y **negrita**) | sin dangerouslySetInnerHTML → React escapa todo el texto (sin XSS)
// [Patrón]: Interpreter (línea → bloque) + Presentational | [Principio]: KISS + YAGNI (sin librería: solo la sintaxis que producimos) | [Paradigma]: Funcional (puro, sirve en RSC y Client)
// ponytail: no soporta tablas, enlaces ni código; si se necesitan, usar `marked` + DOMPurify (ya en Angular)
import type { ReactNode } from "react";
import { youtubeEmbed } from "@/lib/youtube";

// [inline]: **negrita** → <strong> | `split` con grupo de captura conserva los delimitados en índices impares
const inline = (text: string): ReactNode[] => text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));

type Block = { kind: "h" | "p" | "ul" | "ol"; lines: string[]; level?: number };

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
  }, []).filter((b) => b.lines.length);
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {parse(text).map((b, i) =>
        b.kind === "h" ? (
          // [Semántica]: ## → <h3> (la página ya tiene h1/h2) | [SEO + a11y]: jerarquía de títulos coherente
          <h3 key={i} className={b.level === 1 ? "text-base font-bold" : "text-sm font-bold"}>{inline(b.lines[0]!)}</h3>
        ) : b.kind === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">{b.lines.map((l, j) => <li key={j}>{inline(l)}</li>)}</ul>
        ) : b.kind === "ol" ? (
          <ol key={i} className="list-decimal space-y-1 pl-5">{b.lines.map((l, j) => <li key={j}>{inline(l)}</li>)}</ol>
        ) : b.lines.length === 1 && youtubeEmbed(b.lines[0]) ? (
          // [2026-10-25]: un párrafo que es SOLO un enlace de YouTube → video incrustado (cursos importados/compartidos)
          <iframe key={i} src={youtubeEmbed(b.lines[0])!} title="Video de YouTube" className="aspect-video w-full max-w-2xl rounded-lg" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
        ) : (
          <p key={i}>{inline(b.lines.join(" "))}</p>
        ),
      )}
    </div>
  );
}
