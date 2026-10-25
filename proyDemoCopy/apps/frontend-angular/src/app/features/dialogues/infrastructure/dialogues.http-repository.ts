import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { z } from 'zod';
import { API_URL } from '@core/http/api-url.token';
import type { SseData, SseMessage } from '@shared/utils/event-source';
import { postSse } from '@shared/utils/sse-post';
import { DialoguesRepository } from '../domain/dialogues.repository.port';
import {
  DialogueDetailSchema,
  DialogueDraftSchema,
  DialogueSchema,
  SessionDetailSchema,
  SessionSchema,
  StartResultSchema,
  TopicSchema,
  TurnResultSchema,
  TurnSchema,
  type Dialogue,
  type DialogueDetail,
  type DialogueDraft,
  type DialogueFilter,
  type DialogueInput,
  type Session,
  type SessionDetail,
  type DraftRequest,
  type StartResult,
  type Topic,
  type TopicInput,
  type TurnResult,
  type Turn,
} from '../domain/models/dialogues';
// [DialoguesHttpRepository · Infraestructura · Sprints 9.11–9.13]: HttpClient hacia /api/dialogues/* y /api/speech/transcribe (BFF de Next.js → NestJS) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP de la funcionalidad) + DIP | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: ids codificados · filtros como HttpParams · respuestas validadas con Zod · el audio del usuario solo viaja para transcribirse (no se guarda)

@Injectable()
export class DialoguesHttpRepository extends DialoguesRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly base = `${this.api}/dialogues`;
  private readonly id = (v: string) => encodeURIComponent(v);

  private params(f: object): HttpParams {
    return Object.entries(f).reduce(
      (p, [k, v]) => (v === undefined || v === '' || v === false ? p : p.set(k, String(v))),
      new HttpParams(),
    );
  }

  listTopics(filter: { language?: string; level?: string }): Observable<Topic[]> {
    return this.http
      .get<unknown>(`${this.base}/topics`, { params: this.params(filter) })
      .pipe(map((r) => z.array(TopicSchema).parse(r)));
  }

  createTopic(input: TopicInput): Observable<Topic> {
    return this.http
      .post<unknown>(`${this.base}/topics`, input)
      .pipe(map((r) => TopicSchema.parse(r)));
  }

  listDialogues(filter: DialogueFilter): Observable<Dialogue[]> {
    return this.http
      .get<unknown>(this.base, { params: this.params(filter) })
      .pipe(map((r) => z.array(DialogueSchema).parse(r)));
  }

  getDialogue(id: string): Observable<DialogueDetail> {
    return this.http
      .get<unknown>(`${this.base}/${this.id(id)}`)
      .pipe(map((r) => DialogueDetailSchema.parse(r)));
  }

  createDialogue(input: DialogueInput): Observable<Dialogue> {
    return this.http.post<unknown>(this.base, input).pipe(map((r) => DialogueSchema.parse(r)));
  }

  // [readUrl · 2026-10-19]: Route Handler propio de Next.js (no pasa por el proxy a NestJS): descarga la página con safeFetch
  readUrl(url: string): Observable<{ title: string; text: string; holder: string }> {
    return this.http
      .post<unknown>(`${this.api}/dialogues/import-url`, { url })
      .pipe(map((r) => z.object({ title: z.string(), text: z.string(), holder: z.string().default('') }).parse(r)));
  }

  draftDialogue(req: DraftRequest): Observable<DialogueDraft> {
    return this.http.post<unknown>(`${this.base}/draft`, req).pipe(map((r) => DialogueDraftSchema.parse(r)));
  }

  uploadAudio(id: string, file: Blob): Observable<{ aligned: boolean }> {
    const form = new FormData();
    form.append('file', file, file instanceof File ? file.name : 'audio');
    return this.http
      .post<unknown>(`${this.base}/${this.id(id)}/audio`, form)
      .pipe(map((r) => z.object({ aligned: z.boolean() }).parse(r)));
  }

  audioUrl(id: string): string {
    return `${this.base}/${this.id(id)}/audio`;
  }

  confirmLevel(id: string, level: string): Observable<Dialogue> {
    return this.http
      .patch<unknown>(`${this.base}/${this.id(id)}/level`, { level })
      .pipe(map((r) => DialogueSchema.parse(r)));
  }

  withdraw(id: string): Observable<void> {
    return this.http.delete(`${this.base}/${this.id(id)}`).pipe(map(() => undefined));
  }

  startSession(input: {
    topicId: string;
    language: string;
    level: string;
  }): Observable<StartResult> {
    return this.http
      .post<unknown>(`${this.base}/sessions`, input)
      .pipe(map((r) => StartResultSchema.parse(r)));
  }

  listSessions(): Observable<Session[]> {
    return this.http
      .get<unknown>(`${this.base}/sessions/me`)
      .pipe(map((r) => z.array(SessionSchema).parse(r)));
  }

  getSession(id: string): Observable<SessionDetail> {
    return this.http
      .get<unknown>(`${this.base}/sessions/${this.id(id)}`)
      .pipe(map((r) => SessionDetailSchema.parse(r)));
  }

  sendTurn(id: string, text: string): Observable<TurnResult> {
    return this.http
      .post<unknown>(`${this.base}/sessions/${this.id(id)}/turns`, { text })
      .pipe(map((r) => TurnResultSchema.parse(r)));
  }

  // [streamTurn]: SSE por POST (eventos user → token… → avatar → done); el parser vive en shared/utils (DRY con Tutor y Agente Guía)
  streamTurn(id: string, text: string): Observable<SseMessage<SseData>> {
    return postSse(this.http, `${this.base}/sessions/${this.id(id)}/turns/stream`, { text });
  }

  endSession(id: string): Observable<Session> {
    return this.http
      .patch<unknown>(`${this.base}/sessions/${this.id(id)}/end`, {})
      .pipe(map((r) => SessionSchema.parse(r)));
  }

  deleteSession(id: string): Observable<void> {
    return this.http.delete(`${this.base}/sessions/${this.id(id)}`).pipe(map(() => undefined));
  }

  // [transcribe]: misma puerta de NestJS que los juegos orales (/speech/transcribe); aquí solo interesa el texto
  transcribe(audio: Blob, language: string): Observable<string> {
    const body = new FormData();
    body.append('file', audio, 'grabacion.webm');
    body.append('language', language);
    return this.http
      .post<unknown>(`${this.api}/speech/transcribe`, body)
      .pipe(map((r) => z.object({ text: z.string() }).parse(r).text.trim()));
  }

  // [saveRecording · 2026-10-20]: la grabación del turno del usuario se guarda en NestJS (almacén «dialogues») para volver a escucharla
  saveRecording(sessionId: string, turnId: string, audio: Blob): Observable<Turn> {
    const body = new FormData();
    body.append('file', audio, audio.type.includes('mp4') ? 'grabacion.m4a' : 'grabacion.webm');
    return this.http
      .post<unknown>(`${this.base}/sessions/${this.id(sessionId)}/turns/${this.id(turnId)}/recording`, body)
      .pipe(map((r) => TurnSchema.parse(r)));
  }

  recordingUrl(sessionId: string, turnId: string): string {
    return `${this.base}/sessions/${this.id(sessionId)}/turns/${this.id(turnId)}/recording`;
  }
}
