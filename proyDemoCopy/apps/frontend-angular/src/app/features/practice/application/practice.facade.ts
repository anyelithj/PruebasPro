import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { PracticeRepository } from '../domain/practice.repository.port';
import type { Activity, ActivityDetail, ActivityFilter, Attempt } from '../domain/models/practice';
// [PracticeFacade · Aplicación · Sprint 8.14]: casos de uso «actividades disponibles», «resolver un ítem y recibir la corrección al instante» y «avanzar» | [Patrón]: Facade + State Machine (respondiendo → corregido → siguiente) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (signals) + async/await
// [Corrección]: NestJS reenvía a FastAPI Grading (determinista primero, LLM solo para respuestas abiertas) y guarda el intento

@Injectable()
export class PracticeFacade {
  private readonly repo = inject(PracticeRepository);

  readonly list = new AsyncState<Activity[]>((a) => a.length === 0);
  readonly activity = new AsyncState<ActivityDetail>();
  readonly index = signal(0); // Ítem actual
  readonly attempt = signal<Attempt | null>(null); // Corrección del ítem actual
  readonly results = signal<Attempt[]>([]); // Intentos de esta sesión (resumen final)
  readonly checking = signal(false);
  readonly error = signal<string | null>(null);

  readonly item = computed(() => this.activity.data()?.items[this.index()] ?? null);
  readonly total = computed(() => this.activity.data()?.items.length ?? 0);
  readonly done = computed(() => this.total() > 0 && this.index() >= this.total());
  readonly score = computed(() =>
    Math.round(
      (this.results().reduce((s, a) => s + a.score, 0) / Math.max(1, this.results().length)) * 100,
    ),
  );

  // [frequentErrors · RF-113]: tipos de error de la sesión ordenados por frecuencia (resumen al terminar) | `Map` (ES2015) para contar sin mutar los intentos
  readonly frequentErrors = computed(() => {
    const counts = new Map<string, number>();
    for (const a of this.results())
      for (const f of a.feedback.findings) counts.set(f.type, (counts.get(f.type) ?? 0) + 1);
    return [...counts.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([type, count]) => ({ type, count }));
  });

  loadList(filter: ActivityFilter = {}): Promise<Activity[] | null> {
    return this.list.run(this.repo.activities(filter));
  }

  async open(id: string): Promise<void> {
    this.index.set(0);
    this.attempt.set(null);
    this.results.set([]);
    await this.activity.run(this.repo.activity(id));
  }

  // [check]: envía la respuesta del ítem actual y muestra la retroalimentación debajo
  async check(answer: string[]): Promise<Attempt | null> {
    const it = this.item();
    if (!it || this.attempt()) return null;
    this.checking.set(true);
    this.error.set(null);
    try {
      const a = await firstValueFrom(this.repo.submit(it.id, answer));
      this.attempt.set(a);
      this.results.update((r) => [...r, a]);
      return a;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.checking.set(false);
    }
  }

  next(): void {
    this.attempt.set(null);
    this.index.update((i) => i + 1);
  }

  // [retry]: vuelve a empezar la misma actividad (los intentos anteriores quedan en el historial del backend)
  restart(): void {
    this.index.set(0);
    this.attempt.set(null);
    this.results.set([]);
  }
}
