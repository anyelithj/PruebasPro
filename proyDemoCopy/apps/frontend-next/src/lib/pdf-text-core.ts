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
  const ordered = lines.sort((a, b) => b.y - a.y);
  for (const l of ordered) l.parts.sort((a, b) => a.transform[4] - b.transform[4]);
  const gutter = numberedGutter(ordered);
  if (gutter === null) return ordered.map(({ h, parts }) => renderLine(parts, h)).filter(Boolean).join("\n");

  // [Fix 2026-11-03 · «26 … 30» en las soluciones]: página a DOS columnas de ejercicios numerados → antes se unían fila a fila («26. … 30. …»)
  // Ahora: cada bloque de filas se lee columna IZQUIERDA entera y luego la DERECHA; las filas que cruzan el hueco (título, pie) cortan el bloque y quedan en su sitio
  const out: string[] = [];
  let left: string[] = [];
  let right: string[] = [];
  const flush = () => {
    out.push(...left, ...right);
    left = [];
    right = [];
  };
  for (const { h, parts } of ordered) {
    const tol = h;
    const spans = parts.some((p) => p.transform[4] < gutter - tol && p.transform[4] + p.width > gutter + tol);
    if (spans) {
      flush();
      out.push(renderLine(parts, h));
      continue;
    }
    left.push(renderLine(parts.filter((p) => p.transform[4] < gutter - tol), h));
    right.push(renderLine(parts.filter((p) => p.transform[4] >= gutter - tol), h));
  }
  flush();
  return out.filter(Boolean).join("\n");
}

// [renderLine]: fragmentos de una fila (ya ordenados por x) → texto | hueco grande = «\t» (columna/tabla) · hueco pequeño = « »
function renderLine(parts: ReadonlyArray<PdfTextItem>, h: number): string {
  let out = "";
  let end: number | null = null; // x donde terminó el fragmento anterior
  for (const p of parts) {
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
}

// [numberedGutter · 2026-11-03]: x donde empieza la columna derecha si ≥ 2 filas tienen, tras un hueco grande, un ejercicio numerado («28.», «29)»)
// null = una sola columna (o tabla «palabra → traducción», que NO se parte) | [Paradigma]: función pura
function numberedGutter(lines: ReadonlyArray<{ h: number; parts: PdfTextItem[] }>): number | null {
  const starts: number[] = [];
  for (const { h, parts } of lines) {
    for (let i = 1; i < parts.length; i++) {
      const prev = parts[i - 1]!;
      const gap = parts[i]!.transform[4] - (prev.transform[4] + prev.width);
      if (gap > h * 1.5 && /^\s*\d{1,3}[.)](\s|$)/.test(parts[i]!.str)) starts.push(parts[i]!.transform[4]);
    }
  }
  return starts.length >= 2 ? Math.min(...starts) : null;
}

// [OCR_LANG · Sprint 2.5]: idioma ISO 639-1 → modelo de Tesseract | SSOT para el lector de PDF y el importador de recursos
export const OCR_LANG: Readonly<Record<string, string>> = { en: "eng", es: "spa", fr: "fra", de: "deu", pt: "por", ru: "rus", zh: "chi_sim" };
// [OCR_MAX_PAGES]: tope de páginas reconocidas por OCR (lento en navegador y en servidor) | [2026-10-24]: compartido por lib/pdf-text y lib/extract-text-pdf
export const OCR_MAX_PAGES = 15; // ponytail: subir si los cursos traen escaneos largos

// [stripPageFurniture · 2026-11-16]: quita pies y encabezados de página del texto de un PDF (páginas separadas por una línea en blanco, como devuelven pdfText y pdfToText) · pura → navegador y servidor
// Línea del borde (2 primeras / 2 últimas de la página) = mobiliario si es solo un número de página («12», «- 3 -», «Página 3 de 10», «3/10»)
// o si se repite (con los números cambiados por #) en ≥ la mitad de las páginas | [Patrón]: Filter | [Paradigma]: Funcional (pura)
// ponytail: heurística por repetición; un pie distinto en cada página (p. ej. el título del capítulo) se queda
const EDGE = 2;
const PAGE_NUMBER = /^[-–—\s]*(?:p(?:á|a)g(?:ina)?\.?|page|p\.)?\s*\d{1,4}(?:\s*(?:\/|de|of)\s*\d{1,4})?[-–—\s]*$/iu;
const furnitureKey = (line: string) => line.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
// [Cabecera de ficha · 2026-11-16]: membrete de webs de fichas (p. ej. «PDFTests.com Ficha de ejercicios 39 ejercicios · 25 min A1», «F I C H A D E…»,
// «Nombre: Clase: Fecha: Puntuación: / 39», «Haz esta ficha en línea y comprueba tus respuestas al instante») → solo en la zona de cabecera/pie (HEAD_ZONE/FOOT_ZONE líneas)
// ponytail: patrones de los membretes vistos (español/inglés); añadir aquí los de otra web si aparecen
const HEAD_ZONE = 8;
const FOOT_ZONE = 4;
const WORKSHEET = [
  /^\S*[\w-]\.(?:com|net|org|es|co|io|info|edu)(?:\/\S*)?(?:\s|$)/iu, // Empieza por un dominio (marca de la web)
  /^(?:\p{L}\s+){3,}\p{L}$/u, // Letras espaciadas: «F I C H A D E E J E R C I C I O S»
  /\b\d+\s+(?:ejercicios?|exercises?|preguntas|questions)\b.*\b\d+\s*min\b/iu, // «39 ejercicios · 25 min»
  /(?:haz|realiza) esta ficha en l[ií]nea|comprueba tus|respuestas al instante|(?:do|take) this worksheet online|check your answers/iu, // Publicidad de la versión en línea
];
// Campos para rellenar a mano: 2 o más de «Nombre: · Clase: · Fecha: · Puntuación:…» en la misma línea (o uno solo en una línea corta)
const FORM_FIELD = /\b(?:nombre|apellidos?|clase|curso|grupo|fecha|puntuaci[oó]n|nota|name|class|date|score|grade)\s*:/giu;
const isWorksheetChrome = (line: string): boolean => {
  const t = line.trim();
  const fields = t.match(FORM_FIELD)?.length ?? 0;
  return WORKSHEET.some((r) => r.test(t)) || fields >= 2 || (fields === 1 && t.length <= 40);
};
export function stripPageFurniture(raw: string): string {
  const pages = raw.split(/\n{2,}/).map((p) => p.split("\n"));
  const edges = (lines: string[]) => [...new Set([...lines.slice(0, EDGE), ...lines.slice(-EDGE)].map(furnitureKey))];
  const seen = new Map<string, number>(); // Clave normalizada → nº de páginas en cuyo borde aparece
  for (const lines of pages) for (const k of edges(lines)) if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
  const repeated = (k: string) => pages.length >= 2 && (seen.get(k) ?? 0) >= Math.max(2, pages.length / 2);
  return pages
    .map((lines) =>
      lines
        .filter((line, i) => {
          const edge = i < EDGE || i >= lines.length - EDGE;
          const zone = i < HEAD_ZONE || i >= lines.length - FOOT_ZONE; // Cabecera/pie amplios para el membrete de fichas
          if (zone && isWorksheetChrome(line)) return false;
          return !edge || !(PAGE_NUMBER.test(line.trim()) || repeated(furnitureKey(line)));
        })
        .join("\n"),
    )
    .join("\n\n");
}
