import type { Observable } from 'rxjs';
import type {
  Collection,
  CollectionDetail,
  CollectionInput,
  LinePatch,
  LineTiming,
  PracticeRef,
  Song,
  SongDetail,
  SongFilter,
  SongInput,
  SongLine,
  SongPracticeKind,
  SongStatus,
} from './models/music';
// [Puerto MusicRepository · Dominio · Sprints 9.8–9.10]: colecciones, canciones, audio, letra por líneas, tiempos, revisión y prácticas | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección a la vez (sin InjectionToken aparte)

export abstract class MusicRepository {
  abstract listCollections(filter: { language?: string; level?: string }): Observable<Collection[]>;
  abstract getCollection(id: string): Observable<CollectionDetail>;
  abstract createCollection(input: CollectionInput): Observable<Collection>;
  abstract updateCollection(id: string, patch: Partial<CollectionInput>): Observable<Collection>;
  abstract archiveCollection(id: string): Observable<void>;
  abstract listSongs(filter: SongFilter): Observable<Song[]>;
  abstract getSong(id: string): Observable<SongDetail>;
  abstract createSong(input: SongInput): Observable<Song>;
  abstract uploadAudio(id: string, file: Blob): Observable<Song>;
  abstract uploadAudioUrl(id: string, url: string): Observable<Song>; // [2026-10-23]: enlace directo .mp3/.mp4…
  abstract audioUrl(id: string): string; // El <audio> pide los rangos (206) directamente
  abstract loadLyrics(
    id: string,
    lyrics: string,
    auto?: boolean, // false = modo manual (sin IPA ni traducción automáticas)
  ): Observable<{ lines: SongLine[]; enriched: boolean }>;
  abstract patchLines(
    id: string,
    lines: LinePatch[],
    timingSource?: 'manual' | 'auto',
  ): Observable<SongLine[]>;
  abstract proposeTimings(id: string): Observable<{ lines: LineTiming[] }>;
  abstract changeStatus(id: string, status: SongStatus, note?: string): Observable<Song>;
  abstract withdraw(id: string): Observable<void>;
  abstract generatePractice(id: string, kind: SongPracticeKind): Observable<PracticeRef>;
  abstract listPractices(id: string): Observable<PracticeRef[]>;
}
