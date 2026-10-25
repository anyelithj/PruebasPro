import { Injectable } from '@nestjs/common';
import {
  periodLabel,
  ROLE_LABEL,
  type ReportData,
  type ReportRenderer,
} from '../../domain/report-data';
// [ReportDocxRenderer · 2026-10-19]: reporte del sistema en Word (.docx) — mismas secciones que PDF y Excel (resumen, ranking y exámenes) | [Patrón]: Strategy (ReportRenderer) | [Principio]: OCP (formato nuevo = renderizador nuevo, sin tocar el worker) + SRP | [Tecnología]: docx (OOXML puro, sin Word instalado)

const BRAND = '7C3AED'; // Morado de marca en encabezados de tabla

// [loadDocx · 2026-10-19]: `import()` diferido → docx se carga con el primer Word, no al arrancar NestJS | el tipo sale de la misma importación (ESM)
const loadDocx = () => import('docx');
type Docx = Awaited<ReturnType<typeof loadDocx>>;

// [table]: encabezado en negrita sobre morado + filas | [Principio]: DRY (las tres tablas)
function table(d: Docx, headers: string[], rows: (string | number)[][]): InstanceType<Docx['Table']> {
  const { Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = d;
  const cell = (text: string | number, head = false) =>
    new TableCell({
      shading: head ? { fill: BRAND } : undefined,
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: String(text), bold: head, color: head ? 'FFFFFF' : undefined }),
          ],
        }),
      ],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h) => cell(h, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c)) })),
    ],
  });
}

@Injectable()
export class ReportDocxRenderer implements ReportRenderer {
  readonly format = 'docx' as const;
  readonly contentType =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  readonly extension = 'docx';

  async render(data: ReportData): Promise<Buffer> {
    const d = await loadDocx();
    const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } = d;
    const h = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 120 } });
    const doc = new Document({
      creator: 'AulaDeIdiomas',
      title: 'Reporte del sistema',
      sections: [
        {
          children: [
            new Paragraph({ text: 'Reporte del sistema · Aula de Idiomas', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `${periodLabel(data.periodMonths)} · Generado ${data.generatedAt.toISOString()}`, italics: true })],
            }),
            h('Usuarios por rol'),
            table(d,
              ['Rol', 'Usuarios'],
              [...Object.entries(data.users.byRole).map(([r, n]) => [ROLE_LABEL[r] ?? r, n]), ['Total', data.users.total]],
            ),
            h('Ranking de estudiantes'),
            table(d,
              ['#', 'Estudiante', 'Puntos', 'Exámenes', 'Acierto %'],
              data.leaderboard.map((e, i) => [i + 1, e.displayName, e.totalPoints, e.quizzesCompleted, Math.round(e.avgAccuracy * 100)]),
            ),
            h('Exámenes'),
            table(d,
              ['Título', 'Categoría', 'Dificultad', 'Idioma', 'Publicado'],
              data.quizzes.map((q) => [q.title, q.category, q.difficulty, q.language, q.isPublished ? 'Sí' : 'No']),
            ),
          ],
        },
      ],
    });
    return Packer.toBuffer(doc); // `Packer.toBuffer` (docx): zip OOXML en memoria (reportes pequeños)
  }
}
