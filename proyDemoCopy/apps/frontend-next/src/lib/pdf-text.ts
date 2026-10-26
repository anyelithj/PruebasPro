// [pdfText]: extrae el texto de un PDF con pdf.js en un Web Worker (líneas separadas por \n, páginas por \n\n) | [Patrón]: Facade + Lazy Singleton (un solo worker) | [Principio]: DRY (lector en voz alta e importación de recursos) | [Paradigma]: Asíncrono
// [Rendimiento]: `import()` dinámico → pdf.js solo se descarga cuando se usa

// [2026-10-24]: la reconstrucción de líneas y los idiomas de OCR viven en lib/pdf-text-core (puros, también los usa el servidor) → se re-exportan aquí
// para no romper a los importadores existentes (ImportPanel, PdfReader, tests) | [Principio]: OCP (API pública intacta) | `export … from` (ES2015): re-exportación
import { OCR_LANG, OCR_MAX_PAGES, pdfItemsToText, type PdfTextItem } from "./pdf-text-core";
export { OCR_LANG, pdfItemsToText, type PdfTextItem };

// [loadPdf]: Web Worker de pdf.js (una sola vez) + documento desde URL o bytes | [Principio]: DRY (texto y OCR)
async function loadPdf(source: { url: string } | { data: ArrayBuffer }) {
  const pdfjs = await import("pdfjs-dist"); // `import()` dinámico (ES2020): code-splitting
  // [Web Worker]: el parseo corre fuera del hilo principal | `??=` (ES2021): se crea una sola vez
  pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
  // `in` (JS): discrimina la unión | `slice(0)`: copia → pdf.js TRANSFIERE (vacía) el buffer al worker y el llamador puede reutilizar el suyo (p. ej. para el OCR)
  return pdfjs.getDocument("url" in source ? { url: source.url } : { data: new Uint8Array(source.data.slice(0)) });
}

export async function pdfText(source: { url: string } | { data: ArrayBuffer }): Promise<string> {
  const task = await loadPdf(source);
  const doc = await task.promise;
  let raw = "";
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const { items } = await (await doc.getPage(p)).getTextContent();
      // `"str" in it` (TS narrowing): descarta marcadores sin texto | [2026-10-24]: líneas por posición (pdfItemsToText) en vez de `hasEOL`
      raw += pdfItemsToText(items.filter((it): it is typeof it & PdfTextItem => "str" in it)) + "\n\n"; // Fin de página = párrafo nuevo
    }
  } finally {
    void task.destroy(); // Libera memoria del worker aunque falle una página
  }
  return raw;
}


// [pdfOcrText · Sprint 2.5]: PDF escaneado (sin capa de texto) → texto con OCR | pdf.js dibuja cada página en un canvas y Tesseract.js la reconoce en un Web Worker
// [Por qué en el navegador]: sin servidor de OCR ni subir el archivo a terceros (privacidad) · `import()` dinámico: tesseract.js solo se descarga si hace falta
// [2026-10-24]: `source` acepta también los BYTES de un archivo (importación de recursos de un PDF escaneado) | `string` = URL (compatibilidad con PdfReader)
// [Idiomas]: el del contenido (+ español si `withSpanish`) | `Set` (ES2015): sin repetir si el curso es de español
// `withSpanish`: añade el modelo de español (listas «palabra - traducción») — el lector de cursos no lo necesita
export async function pdfOcrText(source: string | { data: ArrayBuffer }, language: string, onProgress?: (page: number, total: number) => void, withSpanish = false): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const doc = await (await loadPdf(typeof source === "string" ? { url: source } : source)).promise;
  const worker = await createWorker([...new Set([OCR_LANG[language] ?? "eng", ...(withSpanish ? ["spa"] : [])])].join("+"));
  const total = Math.min(doc.numPages, OCR_MAX_PAGES);
  let raw = "";
  try {
    for (let p = 1; p <= total; p++) {
      onProgress?.(p, total);
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 2 }); // ×2: más píxeles → mejor reconocimiento
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
      const { data } = await worker.recognize(canvas);
      raw += data.text + "\n\n"; // Fin de página = párrafo nuevo
    }
  } finally {
    await worker.terminate(); // Libera la memoria del worker de OCR
    void doc.cleanup(); // Libera las páginas cacheadas por pdf.js
  }
  return raw;
}
