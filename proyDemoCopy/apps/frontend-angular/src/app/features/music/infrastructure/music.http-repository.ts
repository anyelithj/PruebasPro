import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
import { API_URL } from '@core/http/api-url.token';
import { MusicRepository } from '../domain/music.repository.port';
import {
  CollectionDetailSchema,
  CollectionSchema,
  LineTimingSchema,
  LyricsDraftSchema,
  LyricsLoadSchema,
  MediaLinkRulesSchema,
  PracticeRefSchema,
  SongDetailSchema,
  SongLineSchema,
  SongSchema,
  type Collection,
  type CollectionDetail,
  type CollectionInput,
  type LinePatch,
  type LineTiming,
  type LyricsDraft,
  type LyricsDraftInput,
  type LyricsLoad,
  type MediaLinkRules,
  type PracticeRef,
  type Song,
  type SongDetail,
  type SongFilter,
  type SongInput,
  type SongLine,
  type SongPracticeKind,
  type SongStatus,
} from '../domain/models/music';
// [MusicHttpRepository · Infraestructura · Sprints 9.8–9.10]: HttpClient hacia /api/music/* (BFF de Next.js → NestJS Music) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: ids codificados en la URL · filtros como HttpParams · respuestas validadas con Zod (fail fast si el contrato cambia) · audio por FormData (multipart, ≤ 20 MB)

@Injectable()
export class MusicHttpRepository extends MusicRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/music`;
  private readonly id = (v: string) => encodeURIComponent(v);

  // [params]: solo los filtros con valor | `HttpParams` (Angular) inmutable
  private params(f: object): HttpParams {
    return Object.entries(f).reduce(
      (p, [k, v]) => (v === undefined || v === '' || v === false ? p : p.set(k, String(v))),
      new HttpParams(),
    );
  }

  listCollections(filter: { language?: string; level?: string }): Observable<Collection[]> {
    return this.http
      .get<unknown>(`${this.base}/collections`, { params: this.params(filter) })
      .pipe(map((r) => z.array(CollectionSchema).parse(r)));
  }

  getCollection(id: string): Observable<CollectionDetail> {
    return this.http
      .get<unknown>(`${this.base}/collections/${this.id(id)}`)
      .pipe(map((r) => CollectionDetailSchema.parse(r)));
  }

  createCollection(input: CollectionInput): Observable<Collection> {
    return this.http
      .post<unknown>(`${this.base}/collections`, input)
      .pipe(map((r) => CollectionSchema.parse(r)));
  }

  updateCollection(id: string, patch: Partial<CollectionInput>): Observable<Collection> {
    return this.http
      .patch<unknown>(`${this.base}/collections/${this.id(id)}`, patch)
      .pipe(map((r) => CollectionSchema.parse(r)));
  }

  archiveCollection(id: string): Observable<void> {
    return this.http.delete(`${this.base}/collections/${this.id(id)}`).pipe(map(() => undefined));
  }

  listSongs(filter: SongFilter): Observable<Song[]> {
    return this.http
      .get<unknown>(`${this.base}/songs`, { params: this.params(filter) })
      .pipe(map((r) => z.array(SongSchema).parse(r)));
  }

  getSong(id: string): Observable<SongDetail> {
    return this.http
      .get<unknown>(`${this.base}/songs/${this.id(id)}`)
      .pipe(map((r) => SongDetailSchema.parse(r)));
  }

  createSong(input: SongInput): Observable<Song> {
    return this.http
      .post<unknown>(`${this.base}/songs`, input)
      .pipe(map((r) => SongSchema.parse(r)));
  }

  uploadAudio(id: string, file: Blob): Observable<Song> {
    const form = new FormData(); // `FormData` (Web API): multipart; el navegador pone el boundary
    form.append('file', file, file instanceof File ? file.name : 'audio');
    return this.http
      .post<unknown>(`${this.base}/songs/${this.id(id)}/audio`, form)
      .pipe(map((r) => SongSchema.parse(r)));
  }

  uploadAudioUrl(id: string, url: string): Observable<Song> {
    return this.http
      .post<unknown>(`${this.base}/songs/${this.id(id)}/audio/url`, { url })
      .pipe(map((r) => SongSchema.parse(r)));
  }

  mediaLinkRules(): Observable<MediaLinkRules> {
    return this.http.get<unknown>(`${this.base}/link-rules`).pipe(map((r) => MediaLinkRulesSchema.parse(r)));
  }

  audioUrl(id: string): string {
    return `${this.base}/songs/${this.id(id)}/audio`;
  }

  loadLyrics(id: string, lyrics: string, auto = true): Observable<LyricsLoad> {
    return this.http
      .post<unknown>(`${this.base}/songs/${this.id(id)}/lines`, { lyrics, auto })
      .pipe(map((r) => LyricsLoadSchema.parse(r)));
  }

  reEnrich(id: string): Observable<LyricsLoad> {
    return this.http
      .post<unknown>(`${this.base}/songs/${this.id(id)}/lines/enrich`, {})
      .pipe(map((r) => LyricsLoadSchema.parse(r)));
  }

  draftLyrics(input: LyricsDraftInput): Observable<LyricsDraft> {
    return this.http
      .post<unknown>(`${this.base}/lyrics/draft`, input)
      .pipe(map((r) => LyricsDraftSchema.parse(r)));
  }

  patchLines(
    id: string,
    lines: LinePatch[],
    timingSource?: 'manual' | 'auto',
  ): Observable<SongLine[]> {
    return this.http
      .patch<unknown>(`${this.base}/songs/${this.id(id)}/lines`, {
        lines,
        ...(timingSource ? { timingSource } : {}),
      })
      .pipe(map((r) => z.array(SongLineSchema).parse(r)));
  }

  proposeTimings(id: string): Observable<{ lines: LineTiming[] }> {
    return this.http
      .post<unknown>(`${this.base}/songs/${this.id(id)}/lines/align`, {})
      .pipe(map((r) => z.object({ lines: z.array(LineTimingSchema) }).parse(r)));
  }

  changeStatus(id: string, status: SongStatus, note?: string): Observable<Song> {
    return this.http
      .patch<unknown>(`${this.base}/songs/${this.id(id)}/status`, {
        status,
        ...(note ? { note } : {}),
      })
      .pipe(map((r) => SongSchema.parse(r)));
  }

  withdraw(id: string): Observable<void> {
    return this.http.delete(`${this.base}/songs/${this.id(id)}`).pipe(map(() => undefined));
  }

  generatePractice(id: string, kind: SongPracticeKind): Observable<PracticeRef> {
    return this.http
      .post<unknown>(`${this.base}/songs/${this.id(id)}/practice`, { kind })
      .pipe(map((r) => PracticeRefSchema.parse(r)));
  }

  listPractices(id: string): Observable<PracticeRef[]> {
    return this.http
      .get<unknown>(`${this.base}/songs/${this.id(id)}/practice`)
      .pipe(map((r) => z.array(PracticeRefSchema).parse(r)));
  }
}
