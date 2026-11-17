/** @jest-environment node */
import { buildReportFile, type ReportFormat } from '../reportExport'
import type { ReportTable } from '../reports'

const report: ReportTable = {
  title: 'Procesos y avance en el flujo',
  columns: ['Título', 'Estado', 'Responsables'],
  rows: [
    ['Solicitud de acceso', 'En revisión', 'Ñandú Pérez'],
    ['Alta de proveedor', 'Borrador', 'Sin asignar'],
  ],
}
const meta = { generatedBy: 'Angie', filters: 'ninguno' }

describe('exportación de reportes', () => {
  it.each(['pdf', 'xlsx', 'docx', 'csv'] as ReportFormat[])(
    'genera un archivo %s con contenido',
    async (format) => {
      const blob = await buildReportFile(format, report, meta)
      expect(blob.size).toBeGreaterThan(50)
    },
    30000,
  )
})
