import { computed, inject, Injectable } from '@angular/core';
import { AsyncState } from '@shared/utils/async-state';
import { OwnLlmRepository } from '../domain/own-llm.repository.port';
import { segmentText, type WritingCorrection, type WritingInput, type WritingScope } from '../domain/models/own-llm';
// [OwnLlmFacade · Aplicación]: casos de uso «cargar alcance» y «corregir redacción» + estado con signals | [Patrón]: Facade + State Machine (AsyncState) | [Principio]: SRP (la página no sabe de HTTP) + DIP (depende del puerto) | [Paradigma]: Reactivo
// `@Injectable()` sin providedIn: se provee en own-llm.routes.ts → una instancia por visita a la ruta (estado limpio)

@Injectable()
export class OwnLlmFacade {
  private readonly repo = inject(OwnLlmRepository);

  readonly scope = new AsyncState<WritingScope>();
  readonly correction = new AsyncState<WritingCorrection>();
  private lastText = ''; // Texto exacto que se corrigió (los índices del servidor se refieren a él)

  // `computed`: tramos del texto con los errores marcados (se recalcula solo cuando llega otra corrección)
  readonly segments = computed(() => {
    const c = this.correction.data();
    return c ? segmentText(this.lastText, c.findings) : [];
  });

  loadScope(): Promise<WritingScope | null> {
    return this.scope.run(this.repo.scope());
  }

  correct(input: WritingInput): Promise<WritingCorrection | null> {
    this.lastText = input.text;
    return this.correction.run(this.repo.correct(input));
  }
}
