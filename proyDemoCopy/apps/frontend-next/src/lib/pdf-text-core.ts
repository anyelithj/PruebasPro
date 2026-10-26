// [pdf-text-core · 2026-10-24]: parte PURA del lector de PDF (sin DOM, sin Worker, sin pdf.js) → la comparten el navegador (lib/pdf-text) y el servidor (lib/extract-text-pdf)
// [Por qué un módulo aparte]: lib/pdf-text crea un Web Worker con `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`; si una Route Handler lo importaba
// (solo por OCR_LANG), Turbopack metía esa referencia en el bundle de SERVIDOR → aviso «Package pdfjs-dist can't be external…» | [Principio]: SRP + DRY + ISP
// [Paradigma]: Funcional (funciones puras, testeables sin pdf.js)

// [PdfTextItem]: lo mínimo de un fragmento de texto de pdf.js que usa la reconstrucción de líneas | `transform` = matriz [a,b,c,d,x,y] (posición en la página)
export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

// [pdfItemsToText · 2026-10-24]: fragmentos de UNA página → líneas por POSICIÓN (y) y columnas por HUECOS (x) | [Paradigma]: Funcional (pura, testeable sin pdf.js)
// [Bug que corrige]: antes se concatenaba `str` y solo se cortaba con `hasEOL` → muchos PDF (tablas, listas exportadas de Word/Docs) salían como UNA línea enorme
// o con las celdas pegadas («applemanzana») → el importador decía «No se encontraron elementos». Ahora:
//   · misma línea = misma y (tolerancia: media altura de letra) → «\n» entre líneas
//   · hueco horizontal grande (> 1,5 × altura de letra) = otra columna → «\t» (el importador lo trata como separador de celdas)
//   · hueco pequeño sin espacio explícito → « » (palabras que pdf.js entrega sueltas)
// [Patrón]: Adapter (posiciones → texto plano) | [Principio]: SRP
export function pdfItemsToText(items: ReadonlyArray<PdfTextItem>): string {
  const lines: Array<{ y: number; h: number; parts: PdfTextItem[] }> = [];
  // `filter` (copia) + `sort`: de arriba abajo (y del PDF crece hacia arriba) y de izquierda a derecha
  const sorted = items.filter((it) => it.str !== "").sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  for (const it of sorted) {
    const y = it.transform[5];
    const h = Math.abs(it.height) || Math.abs(it.transform[3]) || 10; // Altura de la letra (pdf.js puede dar 0 en espacios)
    const line = lines.find((l) => Math.abs(l.y - y) <= Math.max(2, Math.min(l.h, h) / 2)); // `find` (ES2015): línea con la misma y
    if (line) line.parts.push(it);
    else lines.push({ y, h, parts: [it] });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map(({ h, parts }) => {
      let out = "";
      let end: number | null = null; // x donde terminó el fragmento anterior
      for (const p of parts.sort((a, b) => a.transform[4] - b.transform[4])) {
        const x = p.transform[4];
        if (end !== null) {
          const gap = x - end;
          if (gap > h * 1.5) out = out.trimEnd() + "\t"; // Columna nueva (tabla o «palabra    traducción»)
          else if (gap > h * 0.15 && !/\s$/.test(out) && !/^\s/.test(p.str)) out += " "; // Palabras separadas sin espacio explícito
        }
        out += p.str;
        end = x + p.width;
      }
      return out.trim();
    })
    .filter(Boolean)
    .join("\n");
}

// [OCR_LANG · Sprint 2.5]: idioma ISO 639-1 → modelo de Tesseract | SSOT para el lector de PDF y el importador de recursos
export const OCR_LANG: Readonly<Record<string, string>> = { en: "eng", es: "spa", fr: "fra", de: "deu", pt: "por", ru: "rus", zh: "chi_sim" };
// [OCR_MAX_PAGES]: tope de páginas reconocidas por OCR (lento en navegador y en servidor) | [2026-10-24]: compartido por lib/pdf-text y lib/extract-text-pdf
export const OCR_MAX_PAGES = 15; // ponytail: subir si los cursos traen escaneos largos
