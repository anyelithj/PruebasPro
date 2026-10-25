// [pdfText]: extrae el texto de un PDF con pdf.js en un Web Worker (líneas separadas por \n, páginas por \n\n) | [Patrón]: Facade + Lazy Singleton (un solo worker) | [Principio]: DRY (lector en voz alta e importación de recursos) | [Paradigma]: Asíncrono
// [Rendimiento]: `import()` dinámico → pdf.js solo se descarga cuando se usa

export async function pdfText(source: { url: string } | { data: ArrayBuffer }): Promise<string> {
  const pdfjs = await import("pdfjs-dist"); // `import()` dinámico (ES2020): code-splitting
  // [Web Worker]: el parseo corre fuera del hilo principal | `??=` (ES2021): se crea una sola vez
  pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
  const task = pdfjs.getDocument("url" in source ? { url: source.url } : { data: new Uint8Array(source.data) }); // `in` (JS): discrimina la unión
  const doc = await task.promise;
  let raw = "";
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const { items } = await (await doc.getPage(p)).getTextContent();
      // `"str" in it` (TS narrowing): descarta marcadores sin texto | `hasEOL` = fin de línea
      for (const it of items) if ("str" in it) raw += it.str + (it.hasEOL ? "\n" : "");
      raw += "\n\n"; // Fin de página
    }
  } finally {
    void task.destroy(); // Libera memoria del worker aunque falle una página
  }
  return raw;
}

// [OCR_LANG · Sprint 2.5]: idioma ISO 639-1 → modelo de Tesseract | SSOT para el lector de PDF y el importador de recursos
export const OCR_LANG: Readonly<Record<string, string>> = { en: "eng", es: "spa", fr: "fra", de: "deu", pt: "por", ru: "rus", zh: "chi_sim" };
const OCR_MAX_PAGES = 15; // ponytail: tope de páginas reconocidas (OCR en el navegador es lento); subir si los cursos traen escaneos largos

// [pdfOcrText · Sprint 2.5]: PDF escaneado (sin capa de texto) → texto con OCR | pdf.js dibuja cada página en un canvas y Tesseract.js la reconoce en un Web Worker
// [Por qué en el navegador]: sin servidor de OCR ni subir el archivo a terceros (privacidad) · `import()` dinámico: tesseract.js solo se descarga si hace falta
export async function pdfOcrText(url: string, language: string, onProgress?: (page: number, total: number) => void): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
  const { createWorker } = await import("tesseract.js");
  const doc = await pdfjs.getDocument({ url }).promise;
  const worker = await createWorker(OCR_LANG[language] ?? "eng");
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
