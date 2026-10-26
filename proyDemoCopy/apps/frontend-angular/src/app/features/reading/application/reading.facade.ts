import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { ReadingRepository } from '../domain/reading.repository.port';
import type { ReadingDetail, ReadingFilter, ReadingProgress, ReadingSummary } from '../domain/models/reading';
// [ReadingFacade · Aplicación · Lectura · 2026-10-25]: casos de uso de la lista y del lector (cargar, guardar el marcador sin bloquear la lectura, empezar de nuevo, enlaces de descarga) | [Patrón]: Facade + State Machine (AsyncState) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals) + async/await

@Injectable()
export class ReadingFacade {
  private readonly repo = inject(ReadingRepository);
  readonly list = new AsyncState<ReadingSummary[]>((l) => !l.length);
  readonly text = new AsyncState<ReadingDetail>();
  private lastSaved = ''; // Último marcador enviado → no se repite la misma petición

  loadList(filter: ReadingFilter) {
    return this.list.run(this.repo.list(filter));
  }

  loadText(id: string) {
    this.lastSaved = '';
    return this.text.run(this.repo.get(id));
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

  exportUrl(id: string, format: 'pdf' | 'txt', include: ReadonlyArray<'translation' | 'ipa'>): string {
    return this.repo.exportUrl(id, format, include);
  }
}
