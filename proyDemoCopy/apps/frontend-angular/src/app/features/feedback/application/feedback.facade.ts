import { inject, Injectable, signal } from '@angular/core';
import { defer, firstValueFrom } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { FeedbackRepository } from '../domain/feedback.repository.port';
import { accuracyByTopic, WEAK_THRESHOLD, type StudyPlanView } from '../domain/models/feedback';
// [FeedbackFacade · Aplicación]: casos de uso «plan de estudio», «recomendaciones» y «progreso por tema» | [Patrón]: Facade + State Machine + Memoization (una carga para las dos pantallas) | [Principio]: SRP + DIP | [Paradigma]: Reactivo + async/await
// Se provee en la ruta padre /estudio → plan y recomendaciones comparten la misma instancia y la misma petición

@Injectable()
export class FeedbackFacade {
  private readonly repo = inject(FeedbackRepository);
  readonly plan = new AsyncState<StudyPlanView | null>();
  readonly progress = signal<Record<string, number>>({}); // Precisión por tema (0..1)
  readonly noData = signal(false); // Sin exámenes completados → nada que analizar
  private started = false;

  // [load]: idempotente salvo `force` (botón Reintentar) | `defer` (RxJS): la cadena async corre al suscribirse
  async load(force = false): Promise<void> {
    if (this.started && !force) return;
    this.started = true;
    await this.plan.run(defer(() => this.compute()));
  }

  // [compute]: historial → precisión por tema → plan (solo si hay datos)
  private async compute(): Promise<StudyPlanView | null> {
    const accuracy = accuracyByTopic(await firstValueFrom(this.repo.history()));
    this.progress.set(accuracy);
    this.noData.set(Object.keys(accuracy).length === 0);
    return this.noData() ? null : firstValueFrom(this.repo.studyPlan(accuracy, WEAK_THRESHOLD));
  }
}
