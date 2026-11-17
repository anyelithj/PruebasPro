import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { OwnLlmRepository } from '../domain/own-llm.repository.port';
import {
  segmentText,
  startReview,
  type Review,
  type WritingCorrection,
  type WritingInput,
  type WritingScope,
} from '../domain/models/own-llm';
// [OwnLlmFacade · Aplicación]: casos de uso «cargar alcance» y «corregir redacción» + estado con signals | [Patrón]: Facade + State Machine (AsyncState) | [Principio]: SRP (la página no sabe de HTTP) + DIP (depende del puerto) | [Paradigma]: Reactivo
// `@Injectable()` sin providedIn: se provee en own-llm.routes.ts → una instancia por visita a la ruta (estado limpio)

@Injectable()
export class OwnLlmFacade {
  private readonly repo = inject(OwnLlmRepository);

  readonly scope = new AsyncState<WritingScope>();
  readonly correction = new AsyncState<WritingCorrection>();
  // [Revisión · 2026-10-27 → 2026-10-28]: FOTO del texto enviado + sus errores (para resaltarlos); el editor sigue libre aparte · null = sin corrección
  readonly review = signal<Review | null>(null);

  // `computed`: tramos del texto con los errores marcados (se recalcula con cada corrección)
  readonly segments = computed(() => {
    const r = this.review();
    return r ? segmentText(r.text, r.findings) : [];
  });

  detect(text: string): Promise<string | null> {
    return firstValueFrom(this.repo.detect(text)).catch(() => null); // Fail Soft: sin detección se sigue pudiendo corregir con «auto»
  }

  loadScope(): Promise<WritingScope | null> {
    return this.scope.run(this.repo.scope());
  }

  async correct(input: WritingInput): Promise<WritingCorrection | null> {
    this.review.set(null);
    const res = await this.correction.run(this.repo.correct(input));
    if (res) this.review.set(startReview(input.text, res.findings)); // Los índices del servidor se refieren al texto exacto enviado
    return res;
  }

  // [reset · 2026-10-28]: «Borrar texto» vacía también el resultado (vuelve al estado inicial) | `set` (signals) sobre el AsyncState
  reset(): void {
    this.review.set(null);
    this.correction.data.set(null);
    this.correction.error.set(null);
    this.correction.status.set('idle');
  }
}
