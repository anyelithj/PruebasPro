import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { z } from 'zod';
import { API_URL } from '@core/http/api-url.token';
import { GamesRepository } from '../domain/games.repository.port';
import {
  AgentTurnSchema,
  CatalogSchema,
  DueCardSchema,
  FluencyMetricSchema,
  GameSessionSchema,
  ScenarioSchema,
  SessionDetailSchema,
  SubmitResultSchema,
  TranscriptionSchema,
  type AgentTurn,
  type Catalog,
  type DueCard,
  type FluencyMetric,
  type GameSession,
  type RoundInput,
  type Scenario,
  type SessionDetail,
  type StartInput,
  type SubmitResult,
  type Transcription,
  type WordStamp,
} from '../domain/models/games';
// [GamesHttpRepository · Infraestructura · Sprints 8.8–8.11]: HttpClient hacia /api/games/* y /api/speech/* (BFF de Next.js → NestJS Games) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: ids codificados · filtros como HttpParams · respuestas validadas con Zod · el audio viaja como multipart (FormData) y NestJS limita su tamaño

@Injectable()
export class GamesHttpRepository extends GamesRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly base = `${this.api}/games`;
  private readonly id = (v: string) => encodeURIComponent(v);

  catalog(): Observable<Catalog> {
    return this.http.get<unknown>(`${this.base}/catalog`).pipe(map((r) => CatalogSchema.parse(r)));
  }

  start(input: StartInput): Observable<GameSession> {
    return this.http
      .post<unknown>(`${this.base}/sessions`, input)
      .pipe(map((r) => GameSessionSchema.parse(r)));
  }

  mine(): Observable<GameSession[]> {
    return this.http
      .get<unknown>(`${this.base}/sessions/me`)
      .pipe(map((r) => z.array(GameSessionSchema).parse(r)));
  }

  session(id: string): Observable<SessionDetail> {
    return this.http
      .get<unknown>(`${this.base}/sessions/${this.id(id)}`)
      .pipe(map((r) => SessionDetailSchema.parse(r)));
  }

  submitRound(sessionId: string, input: RoundInput): Observable<SubmitResult> {
    return this.http
      .post<unknown>(`${this.base}/sessions/${this.id(sessionId)}/rounds`, input)
      .pipe(map((r) => SubmitResultSchema.parse(r)));
  }

  finish(sessionId: string): Observable<GameSession> {
    return this.http
      .patch<unknown>(`${this.base}/sessions/${this.id(sessionId)}/finish`, {})
      .pipe(map((r) => GameSessionSchema.parse(r)));
  }

  cancel(sessionId: string): Observable<void> {
    return this.http
      .delete(`${this.base}/sessions/${this.id(sessionId)}`)
      .pipe(map(() => undefined));
  }

  agentTurn(sessionId: string, message: string, timeToAnswerMs?: number): Observable<AgentTurn> {
    return this.http
      .post<unknown>(`${this.base}/agent/turn`, { sessionId, message, timeToAnswerMs })
      .pipe(map((r) => AgentTurnSchema.parse(r)));
  }

  dueCards(limit = 20): Observable<DueCard[]> {
    return this.http
      .get<unknown>(`${this.base}/flashcards/due`, { params: new HttpParams().set('limit', limit) })
      .pipe(map((r) => z.array(DueCardSchema).parse(r)));
  }

  addCard(entryId: string): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/flashcards`, { entryId });
  }

  // [myEntryIds]: GET /api/vocabulary → solo los ids (el mazo SM-2 se llena con el banco propio)
  myEntryIds(): Observable<string[]> {
    return this.http.get<unknown>(`${this.api}/vocabulary`).pipe(
      map((r) =>
        z
          .array(z.object({ id: z.string() }))
          .parse(r)
          .map((e) => e.id),
      ),
    );
  }

  review(cardId: string, quality: number): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/flashcards/${this.id(cardId)}/review`, {
      quality,
    });
  }

  scenarios(language?: string, level?: string): Observable<Scenario[]> {
    let params = new HttpParams();
    if (language) params = params.set('language', language);
    if (level) params = params.set('level', level);
    return this.http
      .get<unknown>(`${this.base}/scenarios`, { params })
      .pipe(map((r) => z.array(ScenarioSchema).parse(r)));
  }

  scenario(id: string): Observable<Scenario> {
    return this.http
      .get<unknown>(`${this.base}/scenarios/${this.id(id)}`)
      .pipe(map((r) => ScenarioSchema.parse(r)));
  }

  fluency(): Observable<FluencyMetric[]> {
    return this.http
      .get<unknown>(`${this.base}/fluency/me`)
      .pipe(map((r) => z.array(FluencyMetricSchema).parse(r)));
  }

  clearFluency(): Observable<void> {
    return this.http.delete(`${this.base}/fluency/me`).pipe(map(() => undefined));
  }

  // [transcribe]: `FormData` (DOM) → multipart/form-data; HttpClient pone el boundary solo
  transcribe(audio: Blob, language: string): Observable<Transcription> {
    const body = new FormData();
    body.append('file', audio, 'grabacion.webm');
    body.append('language', language);
    return this.http
      .post<unknown>(`${this.api}/speech/transcribe`, body)
      .pipe(map((r) => TranscriptionSchema.parse(r)));
  }

  analyze(words: WordStamp[], targetVocabulary: string[]): Observable<Record<string, unknown>> {
    return this.http.post<Record<string, unknown>>(`${this.api}/speech/fluency`, {
      words,
      targetVocabulary,
    });
  }
}
