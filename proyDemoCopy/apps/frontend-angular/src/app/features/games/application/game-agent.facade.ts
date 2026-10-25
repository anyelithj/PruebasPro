import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GamesRepository } from '../domain/games.repository.port';
import { GamesFacade } from './games.facade';
// [GameAgentFacade · Aplicación · Sprints 8.7/8.9]: turnos contra el agente de juegos (tabú, 20 preguntas, describe y adivina, historia, debate y role-play) | [Patrón]: Facade + State Machine (esperando → pensando → respondió) + Observer (signals) | [Principio]: SRP (conversación) + DIP + DRY (comparte la partida con GamesFacade) | [Paradigma]: Reactivo + async/await
// [Tiempo hasta responder]: se mide desde que el agente terminó de hablar hasta que el usuario envía (métrica de fluidez, RF-105)
// [Turno]: POST /api/games/agent/turn → el motor determinista de FastAPI decide primero (pistas prohibidas, adivinar, objetivos) y el LLM solo redacta; si la IA local tarda, la UI muestra «pensando…»

export interface ChatTurn {
  readonly who: 'user' | 'agent';
  readonly text: string;
  readonly flag?: 'violation' | 'solved'; // Marca del motor (se muestra en texto, no solo color)
  readonly state?: Readonly<Record<string, unknown>>; // Pistas del motor: palabra obligatoria, preguntas restantes, conectores…
}

@Injectable()
export class GameAgentFacade {
  private readonly repo = inject(GamesRepository);
  private readonly games = inject(GamesFacade);

  readonly turns = signal<ChatTurn[]>([]);
  readonly thinking = signal(false);
  readonly finished = signal(false);
  readonly met = signal<string[]>([]); // Objetivos de role-play cumplidos
  readonly error = signal<string | null>(null);
  private readyAt = Date.now();

  // [open]: primer mensaje del agente (apertura del escenario o instrucciones del juego), sin llamar a la red
  open(text: string): void {
    this.turns.set(text ? [{ who: 'agent', text }] : []);
    this.finished.set(false);
    this.met.set(this.games.session()?.content.met ?? []);
    this.readyAt = Date.now();
  }

  async send(message: string): Promise<boolean> {
    const s = this.games.session();
    const text = message.trim();
    if (!s || !text || this.thinking()) return false;
    const timeToAnswerMs = Date.now() - this.readyAt;
    this.turns.update((t) => [...t, { who: 'user', text }]);
    this.thinking.set(true);
    this.error.set(null);
    try {
      const r = await firstValueFrom(this.repo.agentTurn(s.id, text, timeToAnswerMs));
      const state = r.state as { violation?: boolean; solved?: boolean; met?: string[] };
      const flag = state.violation ? 'violation' : state.solved ? 'solved' : undefined;
      this.turns.update((t) => [...t, { who: 'agent', text: r.reply, flag, state: r.state }]);
      if (Array.isArray(state.met)) this.met.set(state.met);
      this.games.adopt({
        ...s,
        roundsCount: s.roundsCount + 1,
        correctCount: s.correctCount + (state.solved ? 1 : 0),
      });
      this.finished.set(r.finished);
      return true;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      this.thinking.set(false);
      this.readyAt = Date.now();
    }
  }
}
