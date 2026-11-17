import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module'; // [Node.js]: `require` explícito y perezoso (ver lazyRequire)
import type { TDocumentDefinitions } from 'pdfmake/interfaces'; // `import type`: solo tipos → no carga pdfmake al arrancar
// [renderPdf · 2026-10-19]: ÚNICO punto que genera PDFs (reportes, certificados y facturas) con pdfmake | [Patrón]: Lazy Singleton + Facade | [Principio]: DRY (antes cada renderizador creaba su PdfPrinter) + rendimiento
// [Por qué perezoso]: pdfmake + pdfkit tardaban ~1,5 s en cargarse al ARRANCAR NestJS aunque nadie pidiera un PDF → ahora se cargan con el primer PDF (y se reutilizan)

type Printer = { createPdfKitDocument(doc: TDocumentDefinitions): NodeJS.ReadableStream & { end(): void } };
let printer: Promise<Printer> | null = null;

// [lazyRequire · 2026-10-28]: `createRequire` (Node.js `node:module`) → `require` CommonJS diferido | `__filename` (CJS): base de resolución de este módulo
// [Por qué no `await import()`]: con `module: NodeNext` TypeScript deja el import() dinámico NATIVO en la salida CJS → Jest (vm) lo rechaza
// («A dynamic import callback was invoked without --experimental-vm-modules») y fallaban certificados y facturas; pdfmake es CommonJS, así que `require` es su carga natural
const lazyRequire = createRequire(__filename);

// [IPA_FONTS · 2026-11-02]: Roboto (pdfmake) NO trae los símbolos IPA (ˈ ə ʊ ʃ…) → salían cuadros. Primera fuente del sistema que los cubre:
// DejaVu (Docker alpine: `font-dejavu`), Arial / Segoe UI (Windows) | ponytail: sin ninguna, IPA vuelve a Roboto (cuadros); embeber DejaVu en el repo si hace falta
const IPA_FONTS = [
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  'C:/Windows/Fonts/arial.ttf',
  'C:/Windows/Fonts/segoeui.ttf',
  '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
];

// [loadPrinter]: carga perezosa (solo con el primer PDF) | fuentes Roboto embebidas (sin archivos en disco)
function loadPrinter(): Promise<Printer> {
  printer ??= (async () => {
    const PdfPrinter = lazyRequire('pdfmake') as typeof import('pdfmake'); // `typeof import()` (TS): solo el tipo, no genera código
    const vfs = lazyRequire('pdfmake/build/vfs_fonts.js') as unknown; // `module.exports = vfs` (mapa {archivo: base64})
    // [VFS]: pdfmake 0.2.x exporta el mapa plano {archivo: base64}; los tipos lo declaran como { vfs } → se aceptan ambas formas
    const files = vfs as unknown as Record<string, string> & { vfs?: Record<string, string> };
    const fonts = files.vfs ?? files;
    const font = (file: string): Buffer => Buffer.from(fonts[file], 'base64');
    const ipaFile = IPA_FONTS.find((f) => existsSync(f));
    const ipa = ipaFile ? readFileSync(ipaFile) : font('Roboto-Regular.ttf');
    return new PdfPrinter({
      Ipa: { normal: ipa, bold: ipa, italics: ipa, bolditalics: ipa }, // Uso: `{ text: '/ˈhæləʊ/', font: 'Ipa' }`
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
