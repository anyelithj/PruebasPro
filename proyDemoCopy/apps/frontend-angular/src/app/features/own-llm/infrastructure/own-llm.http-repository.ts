import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_URL } from '@core/http/api-url.token';
import { OwnLlmRepository } from '../domain/own-llm.repository.port';
import {
  CorrectorResultSchema,
  type CorrectorInput,
  type CorrectorResult,
  WritingCorrectionSchema,
  WritingScopeSchema,
  type WritingCorrection,
  type WritingInput,
  type WritingScope,
} from '../domain/models/own-llm';
// [OwnLlmHttpRepository · Infraestructura]: implementa el puerto con HttpClient hacia /api/ai/own-llm/* (BFF de Next.js → NestJS → FastAPI) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP | [Paradigma]: Reactivo (Observable)
// [Seguridad]: la respuesta se valida con Zod → un cambio de contrato falla aquí y no en la plantilla

@Injectable()
export class OwnLlmHttpRepository extends OwnLlmRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly base = `${this.api}/ai/own-llm`;

  correct(input: WritingInput): Observable<WritingCorrection> {
    // `.pipe(map(...parse))` (RxJS + Zod): DTO → modelo de dominio validado
    return this.http.post<unknown>(`${this.base}/writing-corrections`, input).pipe(map((r) => WritingCorrectionSchema.parse(r)));
  }

  // [correctSentence · 2026-11-13 · Anexo A]: POST /ai/own-llm/corrections → el MISMO corrector que puntúa el turno del diálogo
  correctSentence(input: CorrectorInput): Observable<CorrectorResult> {
    return this.http.post<unknown>(`${this.base}/corrections`, input).pipe(map((r) => CorrectorResultSchema.parse(r)));
  }

  // [detect · 2026-11-02]: reutiliza POST /vocabulary/lookup/detect (FastAPI, determinista, < 5 ms) → «Detectado: X» sin pulsar «Corregir»
  detect(text: string): Observable<string> {
    return this.http.post<{ language: string }>(`${this.api}/vocabulary/lookup/detect`, { text }).pipe(map((r) => r.language));
  }

  scope(): Observable<WritingScope> {
    return this.http.get<unknown>(`${this.base}/scope`).pipe(map((r) => WritingScopeSchema.parse(r)));
  }
}
