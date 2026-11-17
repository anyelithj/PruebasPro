import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { MusicRepository } from '../domain/music.repository.port';
import { NO_LINK_RULES } from '../domain/models/music';
import type {
  Collection,
  CollectionDetail,
  CollectionInput,
  LinePatch,
  LineTiming,
  LyricsDraft,
  LyricsDraftInput,
  LyricsLoad,
  MediaLinkRules,
  PracticeRef,
  Song,
  SongDetail,
  SongFilter,
  SongInput, SongPatch,
  SongPracticeKind,
} from '../domain/models/music';
// [MusicFacade · Aplicación · Sprints 9.8–9.10]: casos de uso de colecciones, canciones, subida (licencia → audio → letra → tiempos), revisión del ADMIN y prácticas | [Patrón]: Facade + State Machine (AsyncState por lista) + Command (`act`) | [Principio]: SRP (las páginas solo pintan) + DIP (puerto del dominio) | [Paradigma]: Reactivo (signals) + async/await

// [EnrichResult · 2026-10-27]: lo que la página necesita para su aviso — `unavailable` distingue «IA caída» de «faltan algunos versos»
export type EnrichResult = Pick<LyricsLoad, 'enriched' | 'missing' | 'unavailable'>;
const MAX_ENRICH_ROUNDS = 25; // ≥ 400 versos (MAX_LINES de NestJS) / 20 por trozo → nunca un bucle infinito

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
  // [pendingLyrics · 2026-10-24]: letra generada con IA que aún no se guardó (la fachada vive en la ruta padre → sobrevive al paso /subir → /subir/:id)
  readonly pendingLyrics = signal('');
  readonly actionError = signal<string | null>(null);
  // [enrichProgress · 2026-10-27]: versos con IPA y traducción / total mientras se encadenan tandas (null = sin proceso en curso)
  readonly enrichProgress = signal<{ done: number; total: number; since: number } | null>(null); // [2026-11-05]: `since` → tiempo transcurrido visible
  // [linkRules · 2026-10-24]: dominios de letras/streaming para validar el enlace del audio en el cliente (se piden una vez por fachada)
  readonly linkRules = signal<MediaLinkRules>(NO_LINK_RULES);
  private linkRulesRequested = false;

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

  async updateSong(id: string, patch: SongPatch): Promise<boolean> {
    const ok = !!(await this.act(this.repo.updateSong(id, patch)));
    if (ok) await this.loadSong(id);
    return ok;
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

  // [loadLinkRules]: Fail-soft — sin reglas solo se valida el formato y el servidor sigue respondiendo con un mensaje claro (no se muestra error)
  async loadLinkRules(): Promise<void> {
    if (this.linkRulesRequested) return;
    this.linkRulesRequested = true;
    try {
      this.linkRules.set(await firstValueFrom(this.repo.mediaLinkRules()));
    } catch {
      this.linkRulesRequested = false; // Reintento en la próxima visita al paso
    }
  }

  // [loadLyrics]: { enriched, missing, unavailable } — missing > 0 = versos guardados sin IPA o sin traducción (se puede reintentar) · null = error visible
  // `auto` (2026-10-19): false = modo manual (líneas sin IPA ni traducción para escribirlas a mano)
  // [2026-10-27 · Bug «No se pudo contactar con el servidor»]: NestJS responde por TANDAS acotadas en tiempo (`more: true` = quedan versos) → aquí se encadenan con /lines/enrich mostrando el progreso, en vez de una sola petición que superaba el timeout del BFF
  async loadLyrics(id: string, lyrics: string, auto = true): Promise<EnrichResult | null> {
    // [Fix 2026-11-05]: el aviso de progreso aparece YA en la primera tanda (antes solo desde la segunda → minutos sin saber si algo pasaba)
    if (auto) this.enrichProgress.set({ done: 0, total: lyrics.split('\n').filter((l) => l.trim()).length, since: Date.now() });
    const r = await this.act(this.repo.loadLyrics(id, lyrics, auto));
    if (!r) this.enrichProgress.set(null);
    return r ? this.continueEnrich(id, r) : null;
  }

  // [loadManualLyrics · 2026-11-06]: versos SIN IA (auto = false) → las líneas nuevas con su id para pegarles el IPA y la traducción manuales
  async loadManualLyrics(id: string, lyrics: string): Promise<LyricsLoad['lines'] | null> {
    return (await this.act(this.repo.loadLyrics(id, lyrics, false)))?.lines ?? null;
  }

  // [retryEnrich · 2026-10-24]: vuelve a pedir IPA y traducción SOLO de los versos que faltan (idempotente)
  async retryEnrich(id: string): Promise<EnrichResult | null> {
    const lines = this.song.data()?.lines ?? [];
    const since = this.enrichProgress()?.since ?? Date.now();
    this.enrichProgress.set({ done: lines.filter((l) => l.ipa && l.translation).length, total: lines.length, since });
    const r = await this.act(this.repo.reEnrich(id));
    if (!r) this.enrichProgress.set(null);
    return r ? this.continueEnrich(id, r) : null;
  }

  // [continueEnrich · 2026-10-27]: mientras NestJS diga `more` (y la IA responda) pide la siguiente tanda; `enrichProgress` alimenta el aviso «n de N versos» | [Patrón]: Continuation + Circuit Breaker simple (MAX_ENRICH_ROUNDS y `unavailable` cortan el bucle)
  private async continueEnrich(id: string, first: LyricsLoad): Promise<EnrichResult> {
    let r: LyricsLoad | null = first;
    let last = first;
    for (let round = 0; r?.more && !r.unavailable && round < MAX_ENRICH_ROUNDS; round++) {
      this.enrichProgress.set({ done: r.lines.length - r.missing, total: r.lines.length, since: this.enrichProgress()?.since ?? Date.now() });
      last = r;
      r = await this.act(this.repo.reEnrich(id)); // null = error ya visible en `actionError` (p. ej. 504) → se sale con lo último conocido
    }
    this.enrichProgress.set(null);
    const end = r ?? last;
    await this.loadSong(id);
    return { enriched: end.enriched, missing: end.missing, unavailable: end.unavailable };
  }

  // [draftLyrics · 2026-10-24]: letra ORIGINAL con IA (idioma, nivel y tema) → el docente la revisa antes de guardarla
  draftLyrics(input: LyricsDraftInput): Promise<LyricsDraft | null> {
    return this.act(this.repo.draftLyrics(input));
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

  // [setPublished · 2026-10-27]: interruptor Publicar (ADMIN; NestJS exige licencia, audio y letra) / Despublicar (autor o ADMIN → vuelve a borrador y los estudiantes dejan de verla)
  async setPublished(id: string, publish: boolean): Promise<boolean> {
    const r = await this.act(this.repo.changeStatus(id, publish ? 'published' : 'draft'));
    if (r) await this.loadSong(id);
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
