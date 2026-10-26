import { READING_GENRE_LABEL, type ReadingGenre } from './reading-genre';
// [ReadingExport · Lectura · 2026-10-25]: forma de la descarga del estudiante — párrafos con cada frase y, a elección, su traducción y su IPA | [Patrón]: Pure Functions + Builder (texto plano) | [Principio]: SRP + DRY (TXT y PDF parten de los mismos bloques) | [Paradigma]: Funcional

export type ExportPart = 'translation' | 'ipa';

export interface ExportSentence {
  paragraph: number;
  text: string;
  translation: string | null;
  ipa: string;
}
export interface ExportText {
  title: string;
  language: string;
  level: string;
  genre: ReadingGenre;
  summary: string | null;
  sourceRef: string | null;
}

// [paragraphsOf]: frases agrupadas por párrafo en orden | `reduce` → lista de listas
export function groupParagraphs<T extends { paragraph: number }>(sentences: readonly T[]): T[][] {
  const out: T[][] = [];
  let last = Number.NaN;
  for (const s of sentences) {
    if (s.paragraph !== last) out.push([]);
    out[out.length - 1]!.push(s);
    last = s.paragraph;
  }
  return out;
}

// [headerLine]: «Cuento · EN · A2» (misma cabecera en TXT y PDF)
export const headerLine = (t: ExportText): string => `${READING_GENRE_LABEL[t.genre] ?? t.genre} · ${t.language.toUpperCase()} · ${t.level}`;

// [toTxt]: texto plano UTF-8 — original por párrafos y, debajo de cada frase, «ES:» y «IPA:» si se pidieron | Función pura
export function toTxt(t: ExportText, sentences: readonly ExportSentence[], include: readonly ExportPart[]): string {
  const withTr = include.includes('translation');
  const withIpa = include.includes('ipa');
  const lines: string[] = [t.title, headerLine(t), ''];
  if (t.summary) lines.push(t.summary, '');
  for (const para of groupParagraphs(sentences)) {
    if (!withTr && !withIpa) {
      lines.push(para.map((s) => s.text).join(' '), ''); // Solo original → párrafo corrido (lectura natural)
      continue;
    }
    for (const s of para) {
      lines.push(s.text);
      if (withIpa && s.ipa) lines.push(`  IPA: /${s.ipa}/`);
      if (withTr && s.translation) lines.push(`  ES: ${s.translation}`);
    }
    lines.push('');
  }
  if (t.sourceRef) lines.push(`Fuente: ${t.sourceRef}`);
  return lines.join('\n').trimEnd() + '\n';
}

// [fileName]: título → nombre de archivo seguro (sin tildes ni símbolos) | `normalize('NFD')` + `\p{M}` (Unicode)
export const fileName = (title: string, ext: string): string =>
  `${
    title
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'lectura'
  }.${ext}`;
