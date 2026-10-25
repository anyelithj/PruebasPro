import type { LeaderboardEntry } from '../../score/domain/interfaces/score.repository.interface';
import type { ReportFormat } from './entities/report-export.entity';
// [Modelo del reporte · Sprint 6.4]: datos agregados (lo mismo que muestra /admin/reports) + puerto de los renderizadores | [Patrón]: DTO de lectura + Strategy (un renderizador por formato) | [Principio]: OCP (formato nuevo = renderizador nuevo) + DIP

export interface ReportQuizRow {
  title: string;
  category: string;
  difficulty: string;
  language: string;
  isPublished: boolean;
  createdAt: Date;
}

export interface ReportData {
  generatedAt: Date;
  periodMonths: number | null;
  users: { total: number; byRole: Record<string, number> };
  leaderboard: LeaderboardEntry[];
  quizzes: ReportQuizRow[];
}

// [Puerto ReportRenderer]: datos → archivo binario
export interface ReportRenderer {
  readonly format: ReportFormat;
  readonly contentType: string;
  readonly extension: string;
  render(data: ReportData): Promise<Buffer>;
}

export const REPORT_RENDERERS = Symbol('REPORT_RENDERERS'); // Registro de estrategias (array inyectado)

// [Etiquetas]: textos compartidos por PDF y Excel | [Principio]: DRY + SSOT
export const periodLabel = (months: number | null): string =>
  months ? `Últimos ${months} meses` : 'Todo el histórico';
export const ROLE_LABEL: Readonly<Record<string, string>> = {
  ADMIN: 'Administradores',
  TEACHER: 'Docentes',
  USER: 'Estudiantes',
};
