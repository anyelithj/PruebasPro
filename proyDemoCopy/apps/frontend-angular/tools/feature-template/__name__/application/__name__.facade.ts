import { inject, Injectable } from '@angular/core';
import { AsyncState } from '@shared/utils/async-state';
import { __Name__Repository } from '../domain/__name__.repository.port';
import type { __Name__ } from '../domain/models/__name__';
// [Plantilla · Fachada]: casos de uso de __name__ + estado con signals | [Patrón]: Facade + State Machine | [Principio]: SRP + DIP

@Injectable()
export class __Name__Facade {
  private readonly repo = inject(__Name__Repository);
  readonly items = new AsyncState<__Name__[]>((rows) => rows.length === 0);

  load(): Promise<__Name__[] | null> {
    return this.items.run(this.repo.list());
  }
}
