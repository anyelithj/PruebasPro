import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_URL } from '@core/http/api-url.token';
import { OwnLlmRepository } from '../domain/own-llm.repository.port';
import {
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
  private readonly base = `${inject(API_URL)}/ai/own-llm`;

  correct(input: WritingInput): Observable<WritingCorrection> {
    // `.pipe(map(...parse))` (RxJS + Zod): DTO → modelo de dominio validado
    return this.http.post<unknown>(`${this.base}/writing-corrections`, input).pipe(map((r) => WritingCorrectionSchema.parse(r)));
  }

  scope(): Observable<WritingScope> {
    return this.http.get<unknown>(`${this.base}/scope`).pipe(map((r) => WritingScopeSchema.parse(r)));
  }
}
