import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { renderPdf } from '../../../../shared/pdf/render-pdf'; // Mismo generador (perezoso) que reportes y certificados
import type { Order } from '../../domain/entities/order.entity';
// [invoicePdf · Sprint 2.6]: factura (comprobante de pago) de una orden pagada o reembolsada en PDF | [Patrón]: Builder (definición declarativa) + Pure Function (orden → bytes) | [Principio]: SRP | [Tecnología]: pdfmake
// [Datos]: los de la orden (snapshot de títulos y precios al comprar) → la factura no cambia aunque cambie el catálogo

// [invoiceNumber]: «AULA-F-2026-1A2B3C4D» (año de pago + inicio del id de la orden: único y estable) | Función pura
export const invoiceNumber = (o: Pick<Order, 'id' | 'paidAt' | 'createdAt'>): string =>
  `AULA-F-${(o.paidAt ?? o.createdAt).getUTCFullYear()}-${o.id.slice(0, 8).toUpperCase()}`;

// `Intl.NumberFormat` (ECMA-402): importe en la moneda de la orden (minor units → unidades)
const money = (minor: number, currency: string) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: currency.toUpperCase() }).format(minor / 100);

export function invoicePdf(order: Order, buyerEmail: string): Promise<Buffer> {
  const date = (order.paidAt ?? order.createdAt).toISOString().slice(0, 10);
  const doc: TDocumentDefinitions = {
    info: { title: `Factura ${invoiceNumber(order)} — Aula de Idiomas` },
    pageMargins: [40, 50, 40, 50],
    // [Reembolsada]: marca de agua → la factura sigue disponible como comprobante, pero queda claro su estado
    watermark: order.status === 'refunded' ? { text: 'REEMBOLSADA', color: '#dc2626', opacity: 0.15, bold: true } : undefined,
    content: [
      { text: 'Aula de Idiomas', style: 'brand' },
      { text: 'Factura / comprobante de pago', style: 'h1' },
      {
        columns: [
          [{ text: `N.º ${invoiceNumber(order)}`, bold: true }, `Fecha: ${date}`, `Orden: ${order.id}`],
          [{ text: 'Cliente', bold: true }, buyerEmail, `Estado: ${order.status === 'refunded' ? 'reembolsada' : 'pagada'}`],
        ],
        margin: [0, 8, 0, 16],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 110],
          body: [
            [{ text: 'Curso', style: 'th' }, { text: 'Importe', style: 'th', alignment: 'right' }],
            ...order.items.map((i) => [i.title, { text: money(i.amountMinor, order.currency), alignment: 'right' }]),
            [{ text: 'Total', bold: true }, { text: money(order.totalMinor, order.currency), bold: true, alignment: 'right' }],
          ],
        },
        layout: 'lightHorizontalLines',
      },
      { text: 'Documento generado por la plataforma. Los precios incluyen los impuestos aplicables.', style: 'muted' },
    ],
    styles: {
      brand: { fontSize: 11, bold: true, color: '#7c3aed' },
      h1: { fontSize: 18, bold: true, color: '#6d28d9', margin: [0, 2, 0, 0] },
      th: { bold: true, color: '#334155' },
      muted: { fontSize: 8, color: '#64748b', margin: [0, 16, 0, 0] },
    },
    defaultStyle: { font: 'Roboto', fontSize: 10 },
  };
  return renderPdf(doc);
}
