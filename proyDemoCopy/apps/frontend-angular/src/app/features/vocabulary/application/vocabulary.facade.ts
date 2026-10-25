import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { VocabularyRepository } from '../domain/vocabulary.repository.port';
import type { Lookup, LookupInput } from '../domain/models/vocabulary';
// [VocabularyFacade · Aplicación · Sprint 8.3]: casos de uso «traducir y obtener IPA» y «guardar la consulta en mi vocabulario» | [Patrón]: Facade + State Machine (AsyncState) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals) + async/await
// [UX]: historial corto de la sesión (sin red) para volver a una consulta anterior con un clic

const HISTORY_SIZE = 8; // Consultas recientes visibles

@Injectable()
export class VocabularyFacade {
  private readonly repo = inject(VocabularyRepository);

  readonly result = new AsyncState<Lookup>();
  readonly history = signal<Lookup[]>([]);
  readonly saving = signal(false);
  readonly saved = signal<string | null>(null); // Término guardado (mensaje de confirmación)
  readonly saveError = signal<string | null>(null);

  // [lookup]: consulta (NestJS responde de la caché si ya existe) y la añade al historial sin duplicados
  async lookup(input: LookupInput): Promise<Lookup | null> {
    this.saved.set(null);
    const r = await this.result.run(this.repo.lookup(input));
    if (r)
      this.history.update((h) => [r, ...h.filter((x) => x.id !== r.id)].slice(0, HISTORY_SIZE));
    return r;
  }

  // [show]: vuelve a una consulta del historial sin pedirla otra vez
  show(item: Lookup): void {
    this.saved.set(null);
    this.result.set(item);
  }

  // [saveToBank]: crea la entrada (NestJS completa traducción e IPA desde la misma caché)
  async saveToBank(item: Lookup): Promise<boolean> {
    this.saving.set(true);
    this.saveError.set(null);
    try {
      await firstValueFrom(
        this.repo.create({ language: item.language as LookupInput['language'], term: item.text }),
      );
      this.saved.set(item.text);
      return true;
    } catch (err) {
      this.saveError.set(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      this.saving.set(false);
    }
  }
}
