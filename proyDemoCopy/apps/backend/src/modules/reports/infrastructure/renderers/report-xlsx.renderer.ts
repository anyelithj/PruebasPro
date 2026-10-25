import { Injectable } from '@nestjs/common';
import type ExcelJS from 'exceljs'; // `import type`: exceljs (~2,7 s de carga) se importa al generar el primer Excel, no al arrancar
import {
  periodLabel,
  ROLE_LABEL,
  type ReportData,
  type ReportRenderer,
} from '../../domain/report-data';
// [ReportXlsxRenderer · Sprint 6.4]: reporte del sistema en Excel, una hoja por sección | [Patrón]: Strategy (ReportRenderer) | [Principio]: SRP | [Tecnología]: exceljs

@Injectable()
export class ReportXlsxRenderer implements ReportRenderer {
  readonly format = 'xlsx' as const;
  readonly contentType =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  readonly extension = 'xlsx';

  async render(data: ReportData): Promise<Buffer> {
    const mod = await import('exceljs'); // `import()` diferido: CommonJS → el módulo llega en `default`
    const wb: ExcelJS.Workbook = new (mod.default ?? mod).Workbook();
    wb.creator = 'AulaDeIdiomas';
    wb.created = data.generatedAt;

    // [sheet]: hoja con cabecera en negrita, fija al desplazar y con filtro | [Principio]: DRY (las tres hojas)
    const sheet = (
      name: string,
      columns: { header: string; key: string; width: number }[],
      rows: Record<string, unknown>[],
    ) => {
      const ws = wb.addWorksheet(name, {
        views: [{ state: 'frozen', ySplit: 1 }],
      });
      ws.columns = columns;
      ws.addRows(rows);
      ws.getRow(1).font = { bold: true };
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length },
      };
      return ws;
    };

    const summary = sheet(
      'Resumen',
      [
        { header: 'Rol', key: 'role', width: 24 },
        { header: 'Usuarios', key: 'n', width: 12 },
      ],
      Object.entries(data.users.byRole).map(([r, n]) => ({
        role: ROLE_LABEL[r] ?? r,
        n,
      })),
    );
    summary.addRow({ role: 'Total', n: data.users.total }).font = {
      bold: true,
    };
    summary.addRow({});
    summary.addRow({ role: periodLabel(data.periodMonths) });
    summary.addRow({ role: `Generado ${data.generatedAt.toISOString()}` });

    sheet(
      'Ranking',
      [
        { header: '#', key: 'pos', width: 6 },
        { header: 'Estudiante', key: 'name', width: 30 },
        { header: 'Puntos', key: 'points', width: 10 },
        { header: 'Exámenes', key: 'quizzes', width: 10 },
        { header: 'Acierto %', key: 'acc', width: 10 },
      ],
      data.leaderboard.map((e, i) => ({
        pos: i + 1,
        name: e.displayName,
        points: e.totalPoints,
        quizzes: e.quizzesCompleted,
        acc: Math.round(e.avgAccuracy * 100),
      })),
    );

    sheet(
      'Exámenes',
      [
        { header: 'Título', key: 'title', width: 40 },
        { header: 'Categoría', key: 'category', width: 16 },
        { header: 'Dificultad', key: 'difficulty', width: 12 },
        { header: 'Idioma', key: 'language', width: 8 },
        { header: 'Publicado', key: 'pub', width: 10 },
        { header: 'Creado', key: 'created', width: 20 },
      ],
      data.quizzes.map((q) => ({
        ...q,
        pub: q.isPublished ? 'Sí' : 'No',
        created: q.createdAt,
      })),
    );

    return Buffer.from(await wb.xlsx.writeBuffer()); // `writeBuffer` (exceljs): archivo completo en memoria (reportes pequeños)
  }
}
