import { computed, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
// [AsyncState · shared/utils]: máquina de estados de una carga (idle → loading → success | empty | error) con signals | [Patrón]: State Machine + Command (`run`) | [Principio]: DRY (las 5 fachadas comparten el ciclo) + SRP | [Paradigma]: Reactivo (signals) + async/await

export type LoadStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export class AsyncState<T> {
  // `signal` (Angular): estado escribible privado al módulo; las plantillas leen los derivados
  readonly data = signal<T | null>(null);
  readonly status = signal<LoadStatus>('idle');
  readonly error = signal<string | null>(null);
  readonly loading = computed(() => this.status() === 'loading');

  // `isEmpty`: decide si un éxito sin datos útiles es «vacío» (lista sin elementos…)
  constructor(private readonly isEmpty: (data: T) => boolean = () => false) {}

  // [run]: ejecuta el Observable (una emisión) y transita de estado; nunca lanza → la UI siempre queda en un estado válido
  async run(source: Observable<T>): Promise<T | null> {
    this.status.set('loading');
    this.error.set(null);
    try {
      const data = await firstValueFrom(source); // `firstValueFrom` (RxJS): Observable → Promise
      this.data.set(data);
      this.status.set(this.isEmpty(data) ? 'empty' : 'success');
      return data;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      this.status.set('error');
      return null;
    }
  }

  // [set]: actualización local (optimista o por evento en vivo) sin pasar por la red
  set(data: T): void {
    this.data.set(data);
    this.status.set(this.isEmpty(data) ? 'empty' : 'success');
  }
}
