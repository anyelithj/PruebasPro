import type { Observable } from 'rxjs';
import type { ReportExport, ReportFormat, ReportProgress } from './models/reports';
// [Puerto ReportsRepository · Dominio]: pedir, listar, borrar exportaciones y seguir su progreso | [Patrón]: Port (Hexagonal) + Repository + Observer (`progress`) | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección

export abstract class ReportsRepository {
  abstract request(format: ReportFormat, periodMonths: number | null): Observable<ReportExport>;
  abstract mine(): Observable<ReportExport[]>;
  abstract remove(id: string): Observable<unknown>;
  abstract downloadUrl(id: string): string;
  abstract progress(): Observable<ReportProgress>;
}
