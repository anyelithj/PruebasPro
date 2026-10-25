import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
// [AnswerTimerComponent · Presentacional · Sprints 8.8/8.10]: mide y muestra el tiempo hasta responder (recuperación rápida, pregunta-respuesta) | [Patrón]: Presentational Component + reloj por signal | [Principio]: SRP (solo muestra; la página calcula los ms al enviar) | [Paradigma]: Reactivo
// [A11y]: `role="timer"` con `aria-live="off"` → el lector no anuncia cada décima (sería ruido); el valor se lee al enfocarlo

@Component({
  selector: 'aula-answer-timer',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    role="timer"
    aria-live="off"
    class="eeg-mono rounded-full bg-muted px-3 py-1 text-sm font-semibold tabular-nums"
    ><aula-icon name="timer" /> {{ seconds() }} s</span
  >`,
})
export class AnswerTimerComponent {
  readonly startedAt = input.required<number>(); // `Date.now()` del momento en que apareció el estímulo
  private readonly now = signal(Date.now());
  protected readonly seconds = computed(() =>
    Math.max(0, (this.now() - this.startedAt()) / 1000).toFixed(1),
  );

  constructor() {
    const id = setInterval(() => this.now.set(Date.now()), 100); // 10 Hz: suficiente para una décima
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
