import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { VocabularyRepository } from '../domain/vocabulary.repository.port';
import type {
  EntryFilter,
  EntryInput,
  EntryPatch,
  VocabularyEntry,
} from '../domain/models/vocabulary';
// [VocabularyEntryFacade · Aplicación · Sprint 8.3]: CRUD del banco de vocabulario — listar con filtros, ver, agregar (con IPA y traducción automáticos), corregir y eliminar | [Patrón]: Facade + State Machine (AsyncState) + Template Method (`act`) | [Principio]: SRP + DIP + DRY | [Paradigma]: Reactivo (signals) + async/await
// [UX]: tras cada escritura se relee la lista con el estado real del backend (la corrección manual marca «revisado»)

@Injectable()
export class VocabularyEntryFacade {
  private readonly repo = inject(VocabularyRepository);

  readonly list = new AsyncState<VocabularyEntry[]>((items) => items.length === 0); // Lista vacía → estado «empty»
  readonly selected = new AsyncState<VocabularyEntry>();
  readonly filter = signal<EntryFilter>({});
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);

  load(filter: EntryFilter = this.filter()): Promise<VocabularyEntry[] | null> {
    this.filter.set(filter);
    return this.list.run(this.repo.list(filter));
  }

  open(id: string): Promise<VocabularyEntry | null> {
    return this.selected.run(this.repo.get(id));
  }

  add(input: EntryInput): Promise<boolean> {
    return this.act(this.repo.create(input));
  }

  // [correct]: guarda la corrección y refresca también la ficha abierta
  async correct(id: string, patch: EntryPatch): Promise<boolean> {
    const ok = await this.act(this.repo.update(id, patch));
    if (ok) await this.open(id);
    return ok;
  }

  remove(id: string): Promise<boolean> {
    return this.act(this.repo.remove(id));
  }

  // [act]: ocupado + error visible + relectura de la lista | [Patrón]: Template Method · [Principio]: DRY
  private async act(op: Observable<unknown>): Promise<boolean> {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(op);
      await this.load();
      return true;
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
