import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { certificateQrSvg } from './certificate-qr'; // [pdfmake 0.2 · servidor]: PdfPrinter genera el PDF con pdfkit
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { renderPdf } from '../../../../shared/pdf/render-pdf'; // [2026-10-19]: pdfmake se carga con el primer PDF (no al arrancar)
import type {
  CertificateDocument,
  CertificateRendererPort,
  RenderedDocument,
} from '../../domain/interfaces/document-renderer.interface';
import {
  CEFR_LEVEL_COLOR,
  type CefrColor,
  isCefrLevel,
  NEUTRAL_LEVEL_COLOR,
} from '../../../../shared/domain/cefr-level.vo';
// [CertificatePdfRenderer · Sprint 7.8]: PDF horizontal tipo diploma — franja, escuadras, sello y QR en el color de la banda MCER — con código de verificación + hash SHA-256 del archivo | [Patrón]: Adapter (CertificateRendererPort → pdfmake) + Builder (definición declarativa) | [Principio]: SRP | [Paradigma]: Declarativo
// [QR]: librería `qrcode` → SVG que pdfmake incrusta vectorial (nodo `{ svg }`) | [Hash]: `crypto.createHash('sha256')` (stdlib de Node)

// [Paleta por nivel]: espejo de packages/ui-tokens/cefr-colors.ts (mismo diploma en PDF y en Angular)
const colorsFor = (level: string | null): CefrColor =>
  level && isCefrLevel(level) ? CEFR_LEVEL_COLOR[level] : NEUTRAL_LEVEL_COLOR;
const W = 842; // A4 horizontal en puntos (595 × 842)
const H = 595;
const TOP = 104; // Margen superior del contenido (debajo de la franja)
const SEAL_Y = TOP + 32; // Centro del sello

// [corner]: escuadra decorativa de 2 trazos (como el diploma de NeuroLearning) | `x/y` = vértice, `dx/dy` = hacia dónde abre
const corner = (
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: string,
) => [
  {
    type: 'line' as const,
    x1: x,
    y1: y,
    x2: x + 34 * dx,
    y2: y,
    lineWidth: 3,
    lineColor: color,
  },
  {
    type: 'line' as const,
    x1: x,
    y1: y,
    x2: x,
    y2: y + 34 * dy,
    lineWidth: 3,
    lineColor: color,
  },
];

@Injectable()
export class CertificatePdfRenderer implements CertificateRendererPort {
  async render(d: CertificateDocument): Promise<RenderedDocument> {
    const qrSvg = await certificateQrSvg(d.verifyUrl, d.cefrLevel);
    const { color, deep } = colorsFor(d.cefrLevel);
    const date = d.issuedAt.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const level = d.cefrLevel && isCefrLevel(d.cefrLevel) ? d.cefrLevel : null;
    const doc: TDocumentDefinitions = {
      info: {
        title: `Certificado ${d.code} — Aula de Idiomas`,
        subject: d.courseTitle,
      }, // Metadatos (accesibilidad)
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [70, TOP, 70, 50],
      // [Fondo]: franja superior con el color profundo del nivel + marco fino + escuadras en el acento del nivel
      background: () => ({
        canvas: [
          { type: 'rect', x: 0, y: 0, w: W, h: 64, color: deep },
          { type: 'rect', x: 0, y: 64, w: W, h: 4, color },
          {
            type: 'rect',
            x: 22,
            y: 84,
            w: W - 44,
            h: H - 106,
            lineWidth: 0.8,
            lineColor: color,
          },
          {
            type: 'ellipse',
            x: W / 2,
            y: SEAL_Y,
            r1: 32,
            r2: 32,
            color,
            fillOpacity: 0.15,
            lineColor: color,
            lineWidth: 2,
          },
          ...corner(14, 76, 1, 1, color),
          ...corner(W - 14, 76, -1, 1, color),
          ...corner(14, H - 14, 1, -1, color),
          ...corner(W - 14, H - 14, -1, -1, color),
        ],
      }),
      header: {
        columns: [
          { text: 'AULA DE IDIOMAS', style: 'brand' },
          {
            text: level ? `NIVEL ${level} · MCER` : 'CERTIFICADO DE CURSO',
            style: 'brand',
            alignment: 'right',
          },
        ],
        margin: [40, 24, 40, 0],
      },
      content: [
        // [Sello]: la banda MCER (o «AULA») dentro del círculo que dibuja el fondo (centro en y = SEAL_Y)
        level
          ? {
              text: level,
              style: 'seal',
              fontSize: 22,
              margin: [0, SEAL_Y - TOP - 14, 0, 28],
              color: deep,
            }
          : {
              text: 'AULA',
              style: 'seal',
              fontSize: 11,
              margin: [0, SEAL_Y - TOP - 7, 0, 33],
              color: deep,
            },
        { text: 'Certificado de finalización', style: 'title' },
        { text: 'Se certifica que', style: 'muted' },
        { text: d.recipientName, style: 'name' },
        { text: 'completó satisfactoriamente el curso', style: 'muted' },
        { text: d.courseTitle, style: 'course', color: deep },
        {
          canvas: [
            {
              type: 'line',
              x1: 200,
              y1: 0,
              x2: W - 340,
              y2: 0,
              lineWidth: 0.6,
              lineColor: color,
            },
          ],
          margin: [0, 22, 0, 22],
        },
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'Fecha de emisión', style: 'label' },
                { text: date, style: 'value' },
                {
                  text: 'Código de verificación',
                  style: 'label',
                  margin: [0, 8, 0, 0],
                },
                { text: d.code, style: 'code', color: deep },
                {
                  text: 'Verifica este certificado escaneando el QR o en:',
                  style: 'label',
                  margin: [0, 8, 0, 2],
                },
                {
                  text: d.verifyUrl,
                  link: d.verifyUrl,
                  color: deep,
                  fontSize: 9,
                },
                {
                  text: 'La huella SHA-256 de este PDF se registra en la red de pruebas Sepolia.',
                  style: 'label',
                  margin: [0, 8, 0, 0],
                },
              ],
            },
            { width: 110, svg: qrSvg, fit: [104, 104] }, // QR de la librería qrcode (color del nivel),
          ],
        },
      ],
      styles: {
        brand: {
          fontSize: 11,
          bold: true,
          color: '#ffffff',
          characterSpacing: 3,
        },
        seal: { bold: true, alignment: 'center' },
        title: {
          fontSize: 28,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 16],
        },
        muted: { fontSize: 12, color: '#555555', alignment: 'center' },
        name: {
          fontSize: 26,
          bold: true,
          alignment: 'center',
          margin: [0, 4, 0, 4],
        },
        course: {
          fontSize: 18,
          bold: true,
          alignment: 'center',
          margin: [0, 4, 0, 0],
        },
        label: { fontSize: 9, color: '#666666' },
        value: { fontSize: 12, bold: true },
        code: { fontSize: 16, bold: true, characterSpacing: 2 },
      },
      defaultStyle: { font: 'Roboto' },
    };
    // [Buffer]: PDF completo → huella SHA-256 del archivo exacto
    const bytes = await renderPdf(doc);
    return {
      bytes,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      contentType: 'application/pdf',
      extension: 'pdf',
    };
  }
}
