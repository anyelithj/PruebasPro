import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { API_URL } from '@core/http/api-url.token';
import { fromEventSource } from '@shared/utils/event-source';
import { ReportsRepository } from '../domain/reports.repository.port';
import {
  downloadUrl,
  ReportExportSchema,
  ReportProgressSchema,
  type ReportExport,
  type ReportFormat,
  type ReportProgress,
} from '../domain/models/reports';
// [ReportsHttpRepository · Infraestructura]: HttpClient hacia /api/reports/export* + SSE /api/events (`report-export`) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP + DRY (SSE con shared/utils) | [Paradigma]: Reactivo
// [Seguridad]: NestJS exige ADMIN y filtra por dueño; aquí solo se valida la forma con Zod

@Injectable()
export class ReportsHttpRepository extends ReportsRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly base = `${this.api}/reports/export`;

  request(format: ReportFormat, periodMonths: number | null): Observable<ReportExport> {
    // Spread condicional: sin periodo no se envía la clave (el DTO la trata como opcional)
    return this.http.post<unknown>(this.base, { format, ...(periodMonths ? { periodMonths } : {}) }).pipe(map((r) => ReportExportSchema.parse(r)));
  }

  mine(): Observable<ReportExport[]> {
    return this.http.get<unknown>(`${this.base}/me`).pipe(map((r) => z.array(ReportExportSchema).parse(r)));
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/${encodeURIComponent(id)}`);
  }

  downloadUrl(id: string): string {
    return downloadUrl(this.api, id);
  }

  progress(): Observable<ReportProgress> {
    return fromEventSource<unknown>(`${this.api}/events`, ['report-export']).pipe(map((m) => ReportProgressSchema.parse(m.data)));
  }
}
