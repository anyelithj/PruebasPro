import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CountdownRingComponent } from './countdown-ring.component';
// [TurnTimerComponent · Presentacional · Sprint 8.9]: cuenta regresiva accesible por turno (debate, historia encadenada) — se reinicia con cada turno y avisa al expirar | [Patrón]: Presentational Component + Observer (`expired`) | [Principio]: SRP (la página decide qué hacer al expirar) | [Paradigma]: Reactivo
// [A11y]: anuncia solo los hitos (10 s y 0 s) por `aria-live`, no cada segundo

@Component({
  selector: 'aula-turn-timer',
  imports: [CountdownRingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <div class="flex items-center gap-3">
      <aula-countdown-ring [total]="seconds()" [remaining]="left()" />
      <p class="sr-only" aria-live="polite">{{ milestone() }}</p>
    </div>
  `,
})
export class TurnTimerComponent {
  readonly seconds = input(60); // Duración del turno
  readonly turnKey = input(0); // Cambia en cada turno → reinicia la cuenta
  readonly running = input(true); // Pausa mientras el agente piensa
  readonly expired = output<void>();
  protected readonly left = signal(60);
  protected readonly milestone = signal('');

  constructor() {
    effect(() => {
      this.turnKey(); // Dependencia: nuevo turno
      const s = this.seconds();
      untracked(() => {
        this.left.set(s);
        this.milestone.set('');
      });
    });
    const id = setInterval(() => {
      if (!this.running() || this.left() <= 0) return;
      this.left.update((v) => v - 1);
      if (this.left() === 10) this.milestone.set('10 s');
      if (this.left() === 0) {
        this.milestone.set('0 s');
        this.expired.emit();
      }
    }, 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
