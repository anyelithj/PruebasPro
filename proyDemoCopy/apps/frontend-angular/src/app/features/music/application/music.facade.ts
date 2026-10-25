import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { MusicRepository } from '../domain/music.repository.port';
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
  SongPracticeKind,
} from '../domain/models/music';
// [MusicFacade · Aplicación · Sprints 9.8–9.10]: casos de uso de colecciones, canciones, subida (licencia → audio → letra → tiempos), revisión del ADMIN y prácticas | [Patrón]: Facade + State Machine (AsyncState por lista) + Command (`act`) | [Principio]: SRP (las páginas solo pintan) + DIP (puerto del dominio) | [Paradigma]: Reactivo (signals) + async/await

@Injectable()
export class MusicFacade {
  private readonly repo = inject(MusicRepository);

  readonly collections = new AsyncState<Collection[]>((l) => !l.length);
  readonly collection = new AsyncState<CollectionDetail>();
  readonly songs = new AsyncState<Song[]>((l) => !l.length);
  readonly mine = new AsyncState<Song[]>((l) => !l.length);
  readonly reviewQueue = new AsyncState<Song[]>((l) => !l.length);
  readonly song = new AsyncState<SongDetail>();
  readonly practices = new AsyncState<PracticeRef[]>((l) => !l.length);
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);

  // [act]: una acción con estado ocupado y error visible; nunca lanza → la UI queda siempre en un estado válido | [Principio]: DRY
  private async act<T>(source: Observable<T>): Promise<T | null> {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      return await firstValueFrom(source);
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  loadCollections(f: { language?: string; level?: string }) {
    return this.collections.run(this.repo.listCollections(f));
  }
  loadCollection(id: string) {
    return this.collection.run(this.repo.getCollection(id));
  }
  loadSongs(f: SongFilter) {
    return this.songs.run(this.repo.listSongs(f));
  }
  loadMine() {
    return this.mine.run(this.repo.listSongs({ mine: true }));
  }
  loadReviewQueue() {
    return this.reviewQueue.run(this.repo.listSongs({ status: 'review' }));
  }
  loadSong(id: string) {
    return this.song.run(this.repo.getSong(id));
  }
  loadPractices(id: string) {
    return this.practices.run(this.repo.listPractices(id));
  }

  async createCollection(input: CollectionInput): Promise<Collection | null> {
    const c = await this.act(this.repo.createCollection(input));
    if (c) this.collections.set([...(this.collections.data() ?? []), c]);
    return c;
  }

  // [toggleInCollection]: agrega o quita una canción de la colección (el orden se conserva)
  async toggleInCollection(c: Collection, songId: string): Promise<boolean> {
    const songIds = c.songIds.includes(songId)
      ? c.songIds.filter((x) => x !== songId)
      : [...c.songIds, songId];
    const saved = await this.act(this.repo.updateCollection(c.id, { songIds }));
    if (saved)
      this.collections.set(
        (this.collections.data() ?? []).map((x) => (x.id === saved.id ? { ...x, ...saved } : x)),
      );
    return !!saved;
  }

  async archiveCollection(id: string): Promise<boolean> {
    const ok = (await this.act(this.repo.archiveCollection(id))) !== null;
    if (ok) this.collections.set((this.collections.data() ?? []).filter((c) => c.id !== id));
    return ok;
  }

  // ───── Subida (asistente de tres pasos) ─────
  createSong(input: SongInput): Promise<Song | null> {
    return this.act(this.repo.createSong(input));
  }

  async uploadAudio(id: string, file: Blob): Promise<boolean> {
    const ok = !!(await this.act(this.repo.uploadAudio(id, file)));
    if (ok) await this.loadSong(id);
    return ok;
  }

  // [uploadAudioUrl · 2026-10-23]: el servidor descarga el enlace directo (mismo límite y formatos que la subida)
  async uploadAudioUrl(id: string, url: string): Promise<boolean> {
    const ok = !!(await this.act(this.repo.uploadAudioUrl(id, url)));
    if (ok) await this.loadSong(id);
    return ok;
  }

  // [loadLyrics]: devuelve false si FastAPI no respondió (líneas guardadas sin IPA → se puede reintentar)
  // `auto` (2026-10-19): false = modo manual (líneas sin IPA ni traducción para escribirlas a mano)
  async loadLyrics(id: string, lyrics: string, auto = true): Promise<boolean | null> {
    const r = await this.act(this.repo.loadLyrics(id, lyrics, auto));
    if (r) await this.loadSong(id);
    return r ? r.enriched : null;
  }

  async saveLines(
    id: string,
    lines: LinePatch[],
    timingSource?: 'manual' | 'auto',
  ): Promise<boolean> {
    const r = await this.act(this.repo.patchLines(id, lines, timingSource));
    const s = this.song.data();
    if (r && s) this.song.set({ ...s, lines: r });
    return !!r;
  }

  async proposeTimings(id: string): Promise<LineTiming[] | null> {
    return (await this.act(this.repo.proposeTimings(id)))?.lines ?? null;
  }

  async submitForReview(id: string): Promise<boolean> {
    const r = await this.act(this.repo.changeStatus(id, 'review'));
    if (r) await this.loadSong(id);
    return !!r;
  }

  // [review]: ADMIN publica o rechaza con motivo; sale de la cola de revisión
  async review(id: string, decision: 'published' | 'rejected', note?: string): Promise<boolean> {
    const r = await this.act(this.repo.changeStatus(id, decision, note));
    if (r) this.reviewQueue.set((this.reviewQueue.data() ?? []).filter((s) => s.id !== id));
    return !!r;
  }

  async withdraw(id: string): Promise<boolean> {
    return (await this.act(this.repo.withdraw(id))) !== null;
  }

  // [practice]: genera (o reutiliza) la actividad y devuelve su id para navegar a /practica/:id
  async practice(id: string, kind: SongPracticeKind): Promise<string | null> {
    return (await this.act(this.repo.generatePractice(id, kind)))?.activityId ?? null;
  }

  audioUrl(id: string): string {
    return this.repo.audioUrl(id);
  }
}
