import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
// [Modelo Reports · Dominio]: exportación del reporte (PDF / Excel) y su ciclo de vida asíncrono (contrato de /api/reports/export*) | [Patrón]: Schema-First (Zod) + State (status) | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional

export const REPORT_FORMATS = ['pdf', 'xlsx', 'docx'] as const; // Espejo de ReportExport.format (NestJS) · [2026-10-19]: + Word
export type ReportFormat = (typeof REPORT_FORMATS)[number];
export const REPORT_STATUSES = ['pending', 'processing', 'ready', 'failed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const PERIOD_MONTHS = [2, 3, 6, 12] as const; // Espejo de ALLOWED_PERIOD_MONTHS (NestJS)

export const ReportExportSchema = z.object({
  id: z.string(),
  format: z.enum(REPORT_FORMATS),
  periodMonths: z.number().nullable(),
  status: z.enum(REPORT_STATUSES),
  sizeBytes: z.number().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
});
export type ReportExport = z.infer<typeof ReportExportSchema>;

// [Evento en vivo]: `report-export` de GET /api/events (lo emite el worker de Bull en cada transición)
export const ReportProgressSchema = z.object({
  id: z.string(),
  status: z.enum(REPORT_STATUSES),
  sizeBytes: z.number().nullable(),
});
export type ReportProgress = z.infer<typeof ReportProgressSchema>;

// [applyProgress]: actualiza la fila del evento; si no está en la lista (otra pestaña), no hace nada | inmutable
export const applyProgress = (rows: readonly ReportExport[], p: ReportProgress): ReportExport[] =>
  rows.map((r) => (r.id === p.id ? { ...r, status: p.status, sizeBytes: p.sizeBytes ?? r.sizeBytes } : r));

// [formatSize]: bytes → «12 KB» (mínimo 1 KB) | null → «—»
export const formatSize = (bytes: number | null): string => (bytes === null ? '—' : `${Math.max(1, Math.round(bytes / 1024))} KB`);

// [downloadUrl]: ruta del BFF que transmite el archivo desde MinIO (Content-Disposition: attachment)
export const downloadUrl = (apiBase: string, id: string): string => `${apiBase}/reports/export/${encodeURIComponent(id)}/download`;
