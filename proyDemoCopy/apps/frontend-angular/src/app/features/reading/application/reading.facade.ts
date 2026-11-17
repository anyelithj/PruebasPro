import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { ReadingRepository } from '../domain/reading.repository.port';
import { mergeLinguistics, type ReadingDetail, type ReadingFilter, type ReadingProgress, type ReadingSummary } from '../domain/models/reading';
// [ReadingFacade · Aplicación · Lectura · 2026-10-25]: casos de uso de la lista y del lector (cargar, guardar el marcador sin bloquear la lectura, empezar de nuevo, enlaces de descarga) | [Patrón]: Facade + State Machine (AsyncState) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals) + async/await
// [2026-10-28 · Traducciones que faltan]: si NestJS responde `enriching: true` (las está generando y guardando), se vuelve a consultar cada POLL_MS
// hasta MAX_POLLS veces y se FUSIONAN traducción/IPA en las frases actuales sin reiniciar la lectura | [Patrón]: Polling acotado + Merge | [Principio]: Fail-soft

const POLL_MS = 5_000; // Cada 5 s (un lote de 20 frases con Ollama en CPU tarda decenas de segundos)
const MAX_POLLS = 240; // Tope ≈ 20 min → nunca sondea indefinidamente | [2026-10-31]: antes 4 min; a 3 frases por lote un texto largo tarda más (la columna se rellena por tandas)

@Injectable()
export class ReadingFacade {
  private readonly repo = inject(ReadingRepository);
  readonly list = new AsyncState<ReadingSummary[]>((l) => !l.length);
  readonly text = new AsyncState<ReadingDetail>();
  readonly translating = signal(false); // `signal` (Angular): hay traducciones generándose en segundo plano → aviso aria-live en el lector
  private lastSaved = ''; // Último marcador enviado → no se repite la misma petición
  private pollTimer: ReturnType<typeof setTimeout> | null = null; // `ReturnType<typeof setTimeout>` (TS): id del temporizador en navegador y Node

  constructor() {
    // `DestroyRef.onDestroy` (Angular): al salir del lector se cancela el sondeo (sin fugas ni peticiones huérfanas)
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  loadList(filter: ReadingFilter) {
    return this.list.run(this.repo.list(filter));
  }

  async loadText(id: string): Promise<ReadingDetail | null> {
    this.lastSaved = '';
    this.stopPolling();
    const data = await this.text.run(this.repo.get(id));
    if (data?.enriching) this.poll(id, 1);
    return data;
  }

  // [poll]: vuelve a pedir el texto mientras NestJS complete traducciones; fusiona por `position` (mergeLinguistics) sin tocar marcador ni estado del reproductor
  private poll(id: string, attempt: number): void {
    this.translating.set(true);
    this.pollTimer = setTimeout(async () => {
      try {
        const fresh = await firstValueFrom(this.repo.get(id));
        const cur = this.text.data();
        if (cur?.id !== id) return this.stopPolling(); // Se navegó a otra lectura
        this.text.set({ ...cur, sentences: mergeLinguistics(cur.sentences, fresh.sentences), pending: fresh.pending, enriching: fresh.enriching });
        if (fresh.enriching && attempt < MAX_POLLS) return this.poll(id, attempt + 1);
      } catch {
        // Fallo de red: se deja de sondear (las traducciones quedan guardadas para la próxima visita)
      }
      this.stopPolling();
    }, POLL_MS);
  }

  // [stopPolling]: pública → el lector la llama al destruirse (la fachada vive en el inyector de la ruta, que sobrevive a la página)
  stopPolling(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.translating.set(false);
  }

  // [saveProgress]: «marcador de lectura» — idempotente y silencioso (un fallo de red no interrumpe la lectura) | devuelve true si se guardó
  async saveProgress(id: string, progress: ReadingProgress): Promise<boolean> {
    const key = `${id}:${progress.sentence}:${progress.word}:${progress.finished}`;
    if (key === this.lastSaved) return true;
    try {
      const saved = await firstValueFrom(this.repo.saveProgress(id, progress));
      this.lastSaved = key;
      const t = this.text.data();
      if (t?.id === id) this.text.set({ ...t, progress: saved }); // El banner «Continuar» refleja el marcador nuevo
      return true;
    } catch {
      return false;
    }
  }

  async resetProgress(id: string): Promise<void> {
    await firstValueFrom(this.repo.resetProgress(id)).catch(() => undefined);
    this.lastSaved = '';
    const t = this.text.data();
    if (t?.id === id) this.text.set({ ...t, progress: null });
  }

  exportUrl(id: string, format: 'pdf' | 'docx', include: ReadonlyArray<'translation' | 'ipa'>): string {
    return this.repo.exportUrl(id, format, include);
  }
}
