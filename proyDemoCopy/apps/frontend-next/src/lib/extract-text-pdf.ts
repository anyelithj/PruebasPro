// [Solo servidor]: pdf.js (build legacy de Node) + Tesseract.js + zlib → nunca se empaqueta para el navegador (lo importa lib/extract-text, que usan las Route Handlers)
import { crc32, deflateSync } from "node:zlib"; // [Node 22.2+]: `crc32` y `deflateSync` → codificar PNG sin dependencias
import { OCR_LANG, OCR_MAX_PAGES, pdfItemsToText, type PdfTextItem } from "@/lib/pdf-text-core"; // [DRY]: misma reconstrucción de líneas que el navegador
// [extract-text-pdf · 2026-10-24]: PDF → texto en el SERVIDOR con dos estrategias:
//   1) capa de texto de pdf.js con líneas por POSICIÓN (pdfItemsToText) — antes se pegaba `str` y se cortaba solo con `hasEOL`
//   2) OCR de respaldo para páginas ESCANEADAS (sin capa de texto): se extraen las imágenes de la página y Tesseract.js las reconoce
// [Bug que corrige]: un PDF escaneado devolvía "" → «El archivo no tiene texto que se pueda leer.» (Cursos → Importar contenido del curso)
// [Patrón]: Strategy (texto → OCR) + Adapter (píxeles de pdf.js → PNG) + Lazy Initialization (el worker de OCR solo se crea si hace falta)
// [Principio]: SRP (lib/extract-text elige el formato; aquí solo PDF) + DRY | [Paradigma]: Funcional + asíncrono

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs"); // `typeof import()` (TS): tipo del módulo sin cargarlo
type PdfPage = Awaited<ReturnType<Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>["getPage"]>>; // Página de pdf.js inferida del API
type OcrWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;

const MIN_PAGE_CHARS = 20; // Menos letras que esto en una página = página escaneada (o solo imágenes) → OCR
const MIN_IMAGE_SIDE = 100; // Imágenes más pequeñas (logos, viñetas) no se reconocen

// [loadPdfJs]: `import()` NATIVO de Node, sin pasar por Turbopack | `webpackIgnore` (comentario mágico, también en Turbopack): deja la importación tal cual
// [Por qué]: pdfjs-dist ya NO está en serverExternalPackages (el SSR del lector del navegador sí necesita empaquetar su worker) y el build legacy
// carga su «fake worker» con otro `import()` relativo que el empaquetador rompería → se resuelve en tiempo de ejecución desde node_modules (Windows/Linux, Node 24)
const loadPdfJs = (): Promise<PdfJs> => import(/* webpackIgnore: true */ "pdfjs-dist/legacy/build/pdf.mjs");

// [assetUrls]: carpetas de CMaps (fuentes CJK/Identity-H), fuentes estándar y wasm (JPX/ICC) de pdfjs-dist | sin ellas algunos PDF devuelven "" o fallan
// `process.getBuiltinModule` (Node 22.3+): `createRequire` sin que el empaquetador intente analizarlo | rutas con «/» (pdf.js exige barra final; fs de Windows acepta «/»)
function assetUrls(): { cMapUrl?: string; standardFontDataUrl?: string; wasmUrl?: string } {
  try {
    const { createRequire } = process.getBuiltinModule("node:module");
    const root = createRequire(`${process.cwd()}/package.json`).resolve("pdfjs-dist/package.json").replace(/\\/g, "/").replace(/package\.json$/, "");
    return { cMapUrl: `${root}cmaps/`, standardFontDataUrl: `${root}standard_fonts/`, wasmUrl: `${root}wasm/` };
  } catch {
    return {}; // Sin rutas: pdf.js sigue leyendo la mayoría de PDF (solo avisa)
  }
}

// [createOcrWorker]: worker de Tesseract con el idioma del contenido + español | `import()` dinámico: tesseract.js solo se carga si hay que reconocer algo
// `Set` (ES2015): sin repetir el modelo si el curso es de español | [Principio]: DRY (imágenes sueltas y páginas escaneadas)
const createOcrWorker = async (language: string): Promise<OcrWorker> =>
  (await import("tesseract.js")).createWorker([...new Set([OCR_LANG[language] ?? "eng", "spa"])].join("+"));

// [withOcrWorker]: crea el worker, ejecuta `fn` y SIEMPRE lo libera | [Patrón]: Loan (préstamo de recurso)
export async function withOcrWorker<T>(language: string, fn: (worker: OcrWorker) => Promise<T>): Promise<T> {
  const worker = await createOcrWorker(language);
  try {
    return await fn(worker);
  } finally {
    await worker.terminate(); // Libera el hilo y la memoria del OCR
  }
}

// [PdfImage]: lo mínimo de una imagen decodificada por pdf.js | `kind`: 1 = 1 bit/píxel, 2 = RGB, 3 = RGBA (ImageKind)
interface PdfImage {
  width: number;
  height: number;
  kind?: number;
  data?: Uint8Array | Uint8ClampedArray;
}

// [toGrayPng]: píxeles de pdf.js → PNG en escala de grises (lo que Tesseract lee en Node) | [Patrón]: Adapter | [Paradigma]: Funcional (pura)
// PNG = firma + IHDR + IDAT (filas con byte de filtro 0, comprimidas con deflate) + IEND; cada bloque lleva su CRC-32
export function toGrayPng({ width: w, height: h, kind, data }: PdfImage): Buffer | null {
  if (!data || w < MIN_IMAGE_SIDE || h < MIN_IMAGE_SIDE) return null;
  const rows = Buffer.alloc((w + 1) * h); // +1: byte de filtro por fila
  const bitRow = Math.ceil(w / 8); // Bytes por fila en imágenes de 1 bit
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let g: number;
      if (kind === 1) g = (data[y * bitRow + (x >> 3)]! >> (7 - (x & 7))) & 1 ? 255 : 0; // `>>` y `&` (bits): 1 = blanco
      else {
        const i = (y * w + x) * (kind === 3 ? 4 : 3); // RGBA o RGB
        g = (data[i]! * 299 + data[i + 1]! * 587 + data[i + 2]! * 114) / 1000; // Luminancia (ITU-R BT.601)
      }
      rows[y * (w + 1) + 1 + x] = g;
    }
  }
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(body.length);
    const typed = Buffer.concat([Buffer.from(type, "latin1"), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([head, typed, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // 8 bits por muestra
  ihdr[9] = 0; // Tipo de color 0 = escala de grises
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

// [objOf]: espera a que pdf.js resuelva un objeto de la página (las imágenes llegan del worker DESPUÉS de la lista de operaciones)
// `get(id, callback)` (pdf.js): avisa cuando el objeto está listo | `Promise.race` (ES2015) con tope OBJ_TIMEOUT_MS → nunca se queda colgado
const OBJ_TIMEOUT_MS = 10_000;
const objOf = (store: PdfPage["objs"], id: string): Promise<PdfImage | null> =>
  Promise.race([
    new Promise<PdfImage | null>((resolve) => store.get(id, (obj: PdfImage | null) => resolve(obj))),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), OBJ_TIMEOUT_MS).unref()), // `unref` (Node): el temporizador no retiene el proceso
  ]);

// [pageImages]: imágenes que PINTA la página (en orden) → PNG | el escaneo de una página suele ser una sola imagen grande (o varias franjas)
// `getOperatorList` (pdf.js): lista de operaciones de dibujo; las imágenes se decodifican en `page.objs` / `page.commonObjs` (ids «g_…»)
async function pageImages(pdfjs: PdfJs, page: PdfPage): Promise<Buffer[]> {
  const { fnArray, argsArray } = await page.getOperatorList();
  const out: Buffer[] = [];
  for (const [i, fn] of fnArray.entries()) {
    const arg = (argsArray[i] as unknown[] | null)?.[0];
    let img: PdfImage | null = null;
    if (fn === pdfjs.OPS.paintImageXObject && typeof arg === "string") img = await objOf(arg.startsWith("g_") ? page.commonObjs : page.objs, arg);
    else if (fn === pdfjs.OPS.paintInlineImageXObject && arg && typeof arg === "object") img = arg as PdfImage; // Imagen en línea: llega en el propio argumento
    const png = img && toGrayPng(img);
    if (png) out.push(png);
  }
  return out;
}

// [pdfToText]: capa de texto por página + OCR de las páginas escaneadas (hasta OCR_MAX_PAGES) | páginas separadas por línea en blanco
export async function pdfToText(data: Uint8Array, language: string): Promise<string> {
  const pdfjs = await loadPdfJs();
  // `disableFontFace`: sin fuentes del sistema (solo se lee texto) | `verbosity: ERRORS`: sin avisos de fuentes en la consola
  const task = pdfjs.getDocument({ data, disableFontFace: true, verbosity: pdfjs.VerbosityLevel.ERRORS, ...assetUrls() });
  const doc = await task.promise;
  let ocr: Promise<OcrWorker> | null = null; // [Lazy]: el worker se crea con la primera página escaneada
  let ocrPages = 0;
  const pages: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const { items } = await page.getTextContent();
      // `"str" in it` (TS narrowing): descarta marcadores sin texto | líneas por posición (y) y columnas por huecos (x)
      let text = pdfItemsToText(items.filter((it): it is typeof it & PdfTextItem => "str" in it));
      if (text.replace(/\s/g, "").length < MIN_PAGE_CHARS && ocrPages < OCR_MAX_PAGES) {
        const images = await pageImages(pdfjs, page);
        if (images.length) {
          ocrPages += 1;
          ocr ??= createOcrWorker(language); // `??=` (ES2021): una sola vez por documento
          const worker = await ocr;
          const parts: string[] = [];
          for (const png of images) parts.push((await worker.recognize(png)).data.text); // Secuencial: un solo worker
          text = [text, ...parts].join("\n").trim();
        }
      }
      pages.push(text);
      page.cleanup(); // Libera los objetos (imágenes) de la página ya leída
    }
  } finally {
    if (ocr) await (await ocr).terminate().catch(() => undefined); // Libera el OCR aunque falle una página
    void task.destroy(); // Libera la memoria de pdf.js
  }
  return pages.join("\n\n");
}
