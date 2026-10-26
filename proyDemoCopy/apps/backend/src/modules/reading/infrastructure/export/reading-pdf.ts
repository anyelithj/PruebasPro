import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'; // `import type`: solo tipos (pdfmake se carga perezosamente en renderPdf)
import {
  groupParagraphs,
  headerLine,
  type ExportPart,
  type ExportSentence,
  type ExportText,
} from '../../domain/reading-export';
// [readingPdf · Lectura · 2026-10-25]: definición declarativa del PDF (pdfmake) — título, cabecera, resumen y párrafos con traducción e IPA opcionales | [Patrón]: Builder (declarativo) + Adapter (dominio → pdfmake) | [Principio]: SRP + DRY (renderPdf compartido con reportes y certificados) | [Paradigma]: Funcional
// [Limitación]: la fuente Roboto embebida cubre latín, cirílico e IPA; los caracteres chinos no se dibujan (el TXT sí los incluye)

const BRAND = '#6D28D9';

export function readingPdf(t: ExportText, sentences: readonly ExportSentence[], include: readonly ExportPart[]): TDocumentDefinitions {
  const withTr = include.includes('translation');
  const withIpa = include.includes('ipa');
  const body: Content[] = groupParagraphs(sentences).map((para) =>
    withTr || withIpa
      ? {
          // Una pila por frase: original + IPA (gris) + traducción (cursiva) | `unbreakable`: la frase no se parte entre páginas
          stack: para.map((s) => ({
            unbreakable: true,
            margin: [0, 0, 0, 6] as [number, number, number, number],
            stack: [
              { text: s.text, fontSize: 12 },
              ...(withIpa && s.ipa ? [{ text: `/${s.ipa}/`, fontSize: 9, color: '#555555' }] : []),
              ...(withTr && s.translation ? [{ text: s.translation, fontSize: 10, italics: true, color: '#333333' }] : []),
            ],
          })),
          margin: [0, 0, 0, 10] as [number, number, number, number],
        }
      : { text: para.map((s) => s.text).join(' '), fontSize: 12, lineHeight: 1.35, margin: [0, 0, 0, 10] as [number, number, number, number] },
  );
  return {
    info: { title: t.title, subject: headerLine(t), creator: 'Aula de Idiomas' },
    pageMargins: [48, 56, 48, 56],
    defaultStyle: { font: 'Roboto' },
    content: [
      { text: t.title, fontSize: 20, bold: true, color: BRAND },
      { text: headerLine(t), fontSize: 10, color: '#666666', margin: [0, 2, 0, 12] },
      ...(t.summary ? [{ text: t.summary, italics: true, fontSize: 10, margin: [0, 0, 0, 12] as [number, number, number, number] }] : []),
      ...body,
      ...(t.sourceRef ? [{ text: `Fuente: ${t.sourceRef}`, fontSize: 8, color: '#777777', margin: [0, 12, 0, 0] as [number, number, number, number] }] : []),
    ],
    footer: (page: number, pages: number) => ({ text: `${page} / ${pages}`, alignment: 'center', fontSize: 8, color: '#999999' }),
  };
}
