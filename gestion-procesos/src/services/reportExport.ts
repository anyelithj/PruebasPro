import { saveAs } from 'file-saver'
import { reportToCsv, type ReportTable } from './reports'

export type ReportFormat = 'pdf' | 'xlsx' | 'docx' | 'csv'
export const FORMAT_LABEL: Record<ReportFormat, string> = { pdf: 'PDF', xlsx: 'Excel', docx: 'Word', csv: 'CSV' }

export interface ReportMeta {
  generatedBy: string
  /** Descripción de los filtros aplicados, p. ej. «Creados desde 2026-01-01». */
  filters: string
}

const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv: 'text/csv;charset=utf-8',
} as const

/** Formato del documento Word (preferencia del equipo): Arial, títulos 18 pt, subtítulos 16 pt, texto 13 pt. */
const WORD = { font: 'Arial', title: 36, subtitle: 32, text: 26 } // tamaños en medios puntos
const BRAND = '1B4D6B'

const infoLines = (r: ReportTable, m: ReportMeta) => [
  `Generado el ${new Date().toLocaleString('es')} por ${m.generatedBy}`,
  `Filtros: ${m.filters || 'ninguno'}`,
  `Registros: ${r.rows.length}`,
]

/** Strategy: un exportador por formato; las librerías pesadas se cargan solo cuando se usan. */
const exporters: Record<ReportFormat, (r: ReportTable, m: ReportMeta) => Promise<Blob>> = {
  async csv(r) {
    return new Blob([reportToCsv(r)], { type: MIME.csv })
  },

  async pdf(r, m) {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    doc.setFont('helvetica', 'bold').setFontSize(18).text(r.title, 40, 50)
    doc.setFont('helvetica', 'normal').setFontSize(10).text(infoLines(r, m), 40, 70)
    autoTable(doc, {
      startY: 105,
      head: [r.columns],
      body: r.rows,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [27, 77, 107] },
      alternateRowStyles: { fillColor: [243, 246, 248] },
    })
    const pages = doc.getNumberOfPages()
    for (let i = 1; i <= pages; i++) {
      doc
        .setPage(i)
        .setFontSize(8)
        .text(
          `Página ${i} de ${pages}`,
          doc.internal.pageSize.getWidth() - 40,
          doc.internal.pageSize.getHeight() - 20,
          { align: 'right' },
        )
    }
    return doc.output('blob')
  },

  async xlsx(r, m) {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = m.generatedBy
    const ws = wb.addWorksheet(r.title.slice(0, 31), { views: [{ state: 'frozen', ySplit: 6 }] })
    ws.addRow([r.title]).font = { bold: true, size: 16 }
    infoLines(r, m).forEach((l) => ws.addRow([l]))
    ws.addRow([])
    const header = ws.addRow(r.columns)
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    header.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND}` } }
    })
    r.rows.forEach((row) => ws.addRow(row))
    ws.columns.forEach((col, i) => {
      const longest = Math.max(r.columns[i]?.length ?? 8, ...r.rows.map((row) => (row[i] ?? '').length))
      col.width = Math.min(50, longest + 2)
    })
    ws.autoFilter = { from: { row: 6, column: 1 }, to: { row: 6, column: r.columns.length } }
    const buffer = await wb.xlsx.writeBuffer()
    return new Blob([buffer], { type: MIME.xlsx })
  },

  async docx(r, m) {
    const {
      Document,
      Packer,
      Paragraph,
      ShadingType,
      Table,
      TableCell,
      TableRow,
      TextRun,
      WidthType,
      PageOrientation,
    } = await import('docx')
    const run = (text: string, extra: object = {}) => new TextRun({ text, font: WORD.font, size: WORD.text, ...extra })
    const cell = (text: string, header = false) =>
      new TableCell({
        shading: header ? { type: ShadingType.CLEAR, color: 'auto', fill: BRAND } : undefined,
        children: [new Paragraph({ children: [run(text, header ? { bold: true, color: 'FFFFFF' } : {})] })],
      })
    const [generated, ...rest] = infoLines(r, m)
    const doc = new Document({
      creator: m.generatedBy,
      title: r.title,
      styles: { default: { document: { run: { font: WORD.font, size: WORD.text } } } },
      sections: [
        {
          properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
          children: [
            new Paragraph({ spacing: { after: 120 }, children: [run(r.title, { bold: true, size: WORD.title })] }),
            new Paragraph({ spacing: { after: 120 }, children: [run(generated, { size: WORD.subtitle })] }),
            ...rest.map((l) => new Paragraph({ children: [run(l)] })),
            new Paragraph({ children: [] }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({ tableHeader: true, children: r.columns.map((c) => cell(c, true)) }),
                ...r.rows.map((row) => new TableRow({ children: row.map((c) => cell(c)) })),
              ],
            }),
          ],
        },
      ],
    })
    return Packer.toBlob(doc)
  },
}

export const buildReportFile = (format: ReportFormat, report: ReportTable, meta: ReportMeta): Promise<Blob> =>
  exporters[format](report, meta)

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export async function downloadReport(format: ReportFormat, report: ReportTable, meta: ReportMeta): Promise<void> {
  const blob = await buildReportFile(format, report, meta)
  saveAs(blob, `${slug(report.title)}-${new Date().toISOString().slice(0, 10)}.${format}`)
}
