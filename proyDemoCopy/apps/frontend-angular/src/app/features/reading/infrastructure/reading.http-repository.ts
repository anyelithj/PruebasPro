import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import * as z from 'zod';
import { API_URL } from '@core/http/api-url.token';
import { ReadingRepository } from '../domain/reading.repository.port';
import {
  ReadingDetailSchema,
  ReadingProgressSchema,
  ReadingSummarySchema,
  type ReadingDetail,
  type ReadingFilter,
  type ReadingProgress,
  type ReadingSummary,
} from '../domain/models/reading';
// [ReadingHttpRepository · Infraestructura · Lectura · 2026-10-25]: HttpClient hacia /api/reading/texts/* (BFF de Next.js → NestJS) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP de la funcionalidad) + DIP | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: ids codificados · filtros como HttpParams · respuestas validadas con Zod (un cambio del backend falla aquí, no en la plantilla)

@Injectable()
export class ReadingHttpRepository extends ReadingRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/reading/texts`;
  private readonly id = (v: string) => encodeURIComponent(v);

  list(filter: ReadingFilter): Observable<ReadingSummary[]> {
    // `reduce` → HttpParams inmutable solo con los filtros elegidos
    const params = Object.entries(filter).reduce((p, [k, v]) => (v ? p.set(k, String(v)) : p), new HttpParams());
    return this.http.get<unknown>(this.base, { params }).pipe(map((r) => z.array(ReadingSummarySchema).parse(r)));
  }

  get(id: string): Observable<ReadingDetail> {
    return this.http.get<unknown>(`${this.base}/${this.id(id)}`).pipe(map((r) => ReadingDetailSchema.parse(r)));
  }

  saveProgress(id: string, progress: ReadingProgress): Observable<ReadingProgress> {
    return this.http
      .patch<unknown>(`${this.base}/${this.id(id)}/progress`, progress)
      .pipe(map((r) => ReadingProgressSchema.parse(r)));
  }

  resetProgress(id: string): Observable<void> {
    return this.http.delete(`${this.base}/${this.id(id)}/progress`).pipe(map(() => undefined));
  }

  // [exportUrl]: enlace directo (`<a download>`): el navegador descarga con la cookie de sesión (mismo origen)
  exportUrl(id: string, format: 'pdf' | 'txt', include: ReadonlyArray<'translation' | 'ipa'>): string {
    const q = new URLSearchParams({ format, ...(include.length ? { include: include.join(',') } : {}) });
    return `${this.base}/${this.id(id)}/export?${q}`;
  }
}
