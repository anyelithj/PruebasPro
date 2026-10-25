import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { PracticeRepository } from '../domain/practice.repository.port';
import type {
  Activity,
  ActivityDetail,
  ActivityContent,
  ActivityInput,
  Draft,
  DraftInput,
  ItemInput,
} from '../domain/models/practice';
// [ActivityBuilderFacade · Aplicación · Sprint 8.15]: constructor de actividades del DOCENTE — crear, editar, agregar/editar/quitar ítems, pedir un borrador a la IA, publicar y archivar | [Patrón]: Facade + Template Method (`act`) + State Machine (borrador → publicado) | [Principio]: SRP + DIP + DRY | [Paradigma]: Reactivo (signals) + async/await
// [Regla]: un borrador de IA nunca se publica solo — entra como «borrador» marcado `aiDraft` y el docente revisa cada ítem antes de publicar (RF-114)

@Injectable()
export class ActivityBuilderFacade {
  private readonly repo = inject(PracticeRepository);

  readonly mine = new AsyncState<Activity[]>((a) => a.length === 0);
  readonly current = new AsyncState<ActivityDetail>();
  readonly draft = new AsyncState<Draft>();
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  loadMine(): Promise<Activity[] | null> {
    return this.mine.run(this.repo.activities({ mine: true }));
  }

  open(id: string): Promise<ActivityDetail | null> {
    return this.current.run(this.repo.activity(id));
  }

  // [create]: crea la actividad (con los ítems del borrador si los hay) y la abre para revisarla
  async create(
    input: ActivityInput,
    items: ItemInput[] = [],
    aiDraft = false,
  ): Promise<Activity | null> {
    let created: Activity | null = null;
    await this.act(this.repo.createActivity({ ...input, aiDraft, items }), async (a) => {
      created = a as Activity;
      await this.open(created.id);
    });
    return created;
  }

  update(id: string, patch: Partial<ActivityInput> & { contents?: ActivityContent[] }): Promise<boolean> {
    return this.act(this.repo.updateActivity(id, patch), () => this.open(id));
  }

  publish(id: string, publish: boolean): Promise<boolean> {
    return this.act(this.repo.updateActivity(id, { status: publish ? 'published' : 'draft' }), () =>
      this.open(id),
    );
  }

  archive(id: string): Promise<boolean> {
    return this.act(this.repo.archiveActivity(id), () => this.loadMine());
  }

  addItem(activityId: string, item: ItemInput): Promise<boolean> {
    return this.act(this.repo.addItem(activityId, item), () => this.open(activityId));
  }

  updateItem(activityId: string, itemId: string, patch: Partial<ItemInput>): Promise<boolean> {
    return this.act(this.repo.updateItem(itemId, patch), () => this.open(activityId));
  }

  removeItem(activityId: string, itemId: string): Promise<boolean> {
    return this.act(this.repo.removeItem(itemId), () => this.open(activityId));
  }

  // [requestDraft]: Ollama (NestJS) propone ítems ORIGINALES; los inválidos se descartan en el backend
  requestDraft(input: DraftInput): Promise<Draft | null> {
    return this.draft.run(this.repo.draft(input));
  }

  // [act]: ocupado + error visible + relectura | [Patrón]: Template Method · [Principio]: DRY
  private async act(
    op: Observable<unknown>,
    after: (result: unknown) => Promise<unknown>,
  ): Promise<boolean> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await after(await firstValueFrom(op));
      return true;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
