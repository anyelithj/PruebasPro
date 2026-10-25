import type { TDocumentDefinitions } from 'pdfmake/interfaces'; // `import type`: solo tipos → no carga pdfmake al arrancar
// [renderPdf · 2026-10-19]: ÚNICO punto que genera PDFs (reportes, certificados y facturas) con pdfmake | [Patrón]: Lazy Singleton + Facade | [Principio]: DRY (antes cada renderizador creaba su PdfPrinter) + rendimiento
// [Por qué perezoso]: pdfmake + pdfkit tardaban ~1,5 s en cargarse al ARRANCAR NestJS aunque nadie pidiera un PDF → ahora se cargan con el primer PDF (y se reutilizan)

type Printer = { createPdfKitDocument(doc: TDocumentDefinitions): NodeJS.ReadableStream & { end(): void } };
let printer: Promise<Printer> | null = null;

// [loadPrinter]: `await import()` (ES2020) → CommonJS `require` diferido tras compilar | fuentes Roboto embebidas (sin archivos en disco)
function loadPrinter(): Promise<Printer> {
  printer ??= (async () => {
    const { default: PdfPrinter } = await import('pdfmake');
    const { default: vfs } = await import('pdfmake/build/vfs_fonts.js'); // `.js`: resolución NodeNext de import() dinámico
    // [VFS]: pdfmake 0.2.x exporta el mapa plano {archivo: base64}; los tipos lo declaran como { vfs } → se aceptan ambas formas
    const files = vfs as unknown as Record<string, string> & { vfs?: Record<string, string> };
    const fonts = files.vfs ?? files;
    const font = (file: string): Buffer => Buffer.from(fonts[file], 'base64');
    return new PdfPrinter({
      Roboto: { normal: font('Roboto-Regular.ttf'), bold: font('Roboto-Medium.ttf'), italics: font('Roboto-Italic.ttf'), bolditalics: font('Roboto-MediumItalic.ttf') },
    }) as unknown as Printer;
  })();
  return printer;
}

// [renderPdf]: definición declarativa → Buffer | `new Promise` (ES2015): pdfkit emite trozos y se unen al terminar
export async function renderPdf(doc: TDocumentDefinitions): Promise<Buffer> {
  const pdf = (await loadPrinter()).createPdfKitDocument(doc);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on('data', (c: Buffer) => chunks.push(c));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.end();
  });
}
