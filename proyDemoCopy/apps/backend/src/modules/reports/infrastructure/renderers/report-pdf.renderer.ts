import { Injectable } from '@nestjs/common';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { renderPdf } from '../../../../shared/pdf/render-pdf'; // [2026-10-19]: pdfmake se carga con el primer PDF (no al arrancar)
import {
  periodLabel,
  ROLE_LABEL,
  type ReportData,
  type ReportRenderer,
} from '../../domain/report-data';
// [ReportPdfRenderer · Sprint 6.4]: reporte del sistema en PDF (resumen, ranking y exámenes) | [Patrón]: Strategy (ReportRenderer) + Builder (definición declarativa del documento) | [Principio]: SRP | [Paradigma]: Declarativo | [Tecnología]: pdfmake

// [VFS]: pdfmake 0.2.x exporta el mapa plano {archivo: base64}; los tipos lo declaran como { vfs } → se aceptan ambas formas
// [table]: tabla con cabecera repetida en cada página | [Principio]: DRY (las tres tablas del reporte)
const table = (
  headers: string[],
  rows: (string | number)[][],
  widths: (string | number)[],
): Content => ({
  table: {
    headerRows: 1,
    widths,
    body: [
      headers.map((h) => ({ text: h, style: 'th' })),
      ...rows.map((r) => r.map(String)),
    ],
  },
  layout: 'lightHorizontalLines',
  margin: [0, 4, 0, 16],
});

@Injectable()
export class ReportPdfRenderer implements ReportRenderer {
  readonly format = 'pdf' as const;
  readonly contentType = 'application/pdf';
  readonly extension = 'pdf';

  render(data: ReportData): Promise<Buffer> {
    const doc: TDocumentDefinitions = {
      info: { title: 'Reporte del sistema — AulaDeIdiomas' }, // Metadatos del PDF (accesibilidad y buscadores)
      pageMargins: [40, 50, 40, 50],
      footer: (page, pages) => ({
        text: `${page} / ${pages}`,
        alignment: 'center',
        fontSize: 8,
        color: '#64748b',
      }),
      content: [
        { text: 'Reporte del sistema', style: 'h1' },
        {
          text: `${periodLabel(data.periodMonths)} · generado ${data.generatedAt.toLocaleString('es')}`,
          style: 'muted',
        },
        { text: `Usuarios (${data.users.total})`, style: 'h2' },
        table(
          ['Rol', 'Usuarios'],
          Object.entries(data.users.byRole).map(([r, n]) => [
            ROLE_LABEL[r] ?? r,
            n,
          ]),
          ['*', 80],
        ),
        { text: 'Ranking', style: 'h2' },
        table(
          ['#', 'Estudiante', 'Puntos', 'Exámenes', 'Acierto'],
          data.leaderboard.map((e, i) => [
            i + 1,
            e.displayName,
            e.totalPoints,
            e.quizzesCompleted,
            `${Math.round(e.avgAccuracy * 100)} %`,
          ]),
          [20, '*', 60, 60, 60],
        ),
        { text: `Exámenes (${data.quizzes.length})`, style: 'h2' },
        table(
          ['Título', 'Categoría', 'Dificultad', 'Idioma', 'Publicado'],
          data.quizzes.map((q) => [
            q.title,
            q.category,
            q.difficulty,
            q.language,
            q.isPublished ? 'Sí' : 'No',
          ]),
          ['*', 70, 60, 45, 50],
        ),
      ],
      styles: {
        h1: { fontSize: 18, bold: true, color: '#6d28d9' }, // Morado de la marca
        h2: { fontSize: 13, bold: true, margin: [0, 8, 0, 2] },
        th: { bold: true, color: '#334155' },
        muted: { fontSize: 9, color: '#64748b', margin: [0, 2, 0, 8] },
      },
      defaultStyle: { font: 'Roboto', fontSize: 10 },
    };
    return renderPdf(doc);
  }
}
