import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { GamesRepository } from '../domain/games.repository.port';
import type {
  Catalog,
  DueCard,
  FluencyMetric,
  GameSession,
  RoundInput,
  Scenario,
  SessionDetail,
  StartInput,
  SubmitResult,
} from '../domain/models/games';
// [GamesFacade · Aplicación · Sprints 8.8–8.11]: casos de uso «catálogo», «empezar partida», «responder ronda», «terminar / abandonar», «resultado», «mazo SM-2», «escenarios» y «progreso de fluidez» | [Patrón]: Facade + State Machine (AsyncState + fase de la partida) | [Principio]: SRP + DIP + DRY (todas las páginas de juego comparten este ciclo) | [Paradigma]: Reactivo (signals) + async/await
// [Fase de la partida]: idle → playing → finished · `last` guarda el veredicto de la ronda para el feedback inmediato

export type GamePhase = 'idle' | 'starting' | 'playing' | 'finished';

@Injectable()
export class GamesFacade {
  private readonly repo = inject(GamesRepository);

  readonly catalog = new AsyncState<Catalog>();
  readonly history = new AsyncState<GameSession[]>((s) => s.length === 0);
  readonly result = new AsyncState<SessionDetail>();
  readonly due = new AsyncState<DueCard[]>((c) => c.length === 0);
  readonly scenarios = new AsyncState<Scenario[]>((s) => s.length === 0);
  readonly fluency = new AsyncState<FluencyMetric[]>((m) => m.length === 0);

  readonly session = signal<GameSession | null>(null);
  readonly phase = signal<GamePhase>('idle');
  readonly last = signal<SubmitResult | null>(null); // Última ronda calificada
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly answered = computed(() => this.session()?.roundsCount ?? 0);

  loadCatalog(): Promise<Catalog | null> {
    return this.catalog.run(this.repo.catalog());
  }

  loadHistory(): Promise<GameSession[] | null> {
    return this.history.run(this.repo.mine());
  }

  // [start]: crea la partida en NestJS (el contenido lo elige el backend: banco propio CC BY o tu vocabulario)
  async start(input: StartInput): Promise<GameSession | null> {
    this.phase.set('starting');
    this.last.set(null);
    const s = await this.guard(() => firstValueFrom(this.repo.start(input)));
    this.session.set(s);
    this.phase.set(s ? 'playing' : 'idle');
    return s;
  }

  // [answer]: envía la ronda; actualiza contadores locales para la barra de progreso (el puntaje real lo calcula `finish`)
  async answer(input: RoundInput): Promise<SubmitResult | null> {
    const s = this.session();
    if (!s) return null;
    const r = await this.guard(() => firstValueFrom(this.repo.submitRound(s.id, input)));
    if (r) {
      this.last.set(r);
      this.session.set({
        ...s,
        roundsCount: s.roundsCount + 1,
        correctCount: s.correctCount + (r.verdict.correct ? 1 : 0),
      });
    }
    return r;
  }

  // [finish]: cierra y carga el resumen (rondas + métricas) para la pantalla de resultado
  async finish(): Promise<SessionDetail | null> {
    const s = this.session();
    if (!s) return null;
    const done = await this.guard(() => firstValueFrom(this.repo.finish(s.id)));
    if (!done) return null;
    this.session.set(done);
    this.phase.set('finished');
    return this.result.run(this.repo.session(s.id));
  }

  async cancel(): Promise<void> {
    const s = this.session();
    if (s?.status === 'active') await this.guard(() => firstValueFrom(this.repo.cancel(s.id)));
    this.session.set(null);
    this.phase.set('idle');
  }

  // [reset]: estado limpio al entrar a un juego (la fachada vive en la ruta /juegos y la comparten todas sus pantallas)
  reset(): void {
    this.session.set(null);
    this.phase.set('idle');
    this.last.set(null);
    this.error.set(null);
  }

  // [adopt]: otra fachada (agente) actualizó la partida → la comparten
  adopt(session: GameSession): void {
    this.session.set(session);
  }

  loadResult(id: string): Promise<SessionDetail | null> {
    return this.result.run(this.repo.session(id));
  }

  loadDue(): Promise<DueCard[] | null> {
    return this.due.run(this.repo.dueCards());
  }

  // [review]: calidad SM-2 (0–5) → el backend agenda la próxima repetición; la tarjeta sale del mazo de hoy
  async review(card: DueCard, quality: number): Promise<boolean> {
    const ok =
      (await this.guard(() => firstValueFrom(this.repo.review(card.id, quality)))) !== null;
    if (ok) this.due.set((this.due.data() ?? []).filter((c) => c.id !== card.id));
    return ok;
  }

  // [fillDeck]: agrega todo el banco de vocabulario al mazo (idempotente en NestJS) y relee las tarjetas de hoy → devuelve cuántas palabras se enviaron
  async fillDeck(): Promise<number> {
    const ids = await this.guard(() => firstValueFrom(this.repo.myEntryIds()));
    if (!ids?.length) return 0;
    // `Promise.all` (ES2015): altas en paralelo — cada una es idempotente
    await this.guard(() => Promise.all(ids.map((id) => firstValueFrom(this.repo.addCard(id)))));
    await this.loadDue();
    return ids.length;
  }

  loadScenarios(language?: string, level?: string): Promise<Scenario[] | null> {
    return this.scenarios.run(this.repo.scenarios(language, level));
  }

  loadFluency(): Promise<FluencyMetric[] | null> {
    return this.fluency.run(this.repo.fluency());
  }

  async clearFluency(): Promise<void> {
    if ((await this.guard(() => firstValueFrom(this.repo.clearFluency()))) !== null)
      this.fluency.set([]);
  }

  // [guard]: ocupado + error visible; devuelve null si falla (la UI nunca queda colgada) | [Patrón]: Template Method · [Principio]: DRY
  private async guard<T>(op: () => Promise<T>): Promise<T | null> {
    this.busy.set(true);
    this.error.set(null);
    try {
      return (await op()) ?? (true as T);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.busy.set(false);
    }
  }
}
