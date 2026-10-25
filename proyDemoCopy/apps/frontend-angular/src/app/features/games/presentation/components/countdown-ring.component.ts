import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
// [CountdownRingComponent · Presentacional · Sprint 8.9]: cuenta regresiva circular en SVG propio | [Patrón]: Presentational Component | [Principio]: SRP + sin librería nueva | [Paradigma]: Declarativo
// [A11y]: no depende del color — el número de segundos está en el centro y en `aria-label`; el anillo es decorativo · [Movimiento]: la transición del trazo respeta «reducir movimiento» (motion.css)

const R = 26; // Radio del anillo (viewBox 64)
const C = 2 * Math.PI * R; // Circunferencia → longitud del trazo

@Component({
  selector: 'aula-countdown-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative grid size-16 place-items-center"
      role="timer"
      [attr.aria-label]="remaining() + ' s'"
    >
      <svg viewBox="0 0 64 64" class="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" [attr.r]="r" fill="none" stroke="var(--border)" stroke-width="6" />
        <circle
          cx="32"
          cy="32"
          [attr.r]="r"
          fill="none"
          stroke="var(--btn-solid)"
          stroke-width="6"
          stroke-linecap="round"
          [attr.stroke-dasharray]="c"
          [attr.stroke-dashoffset]="offset()"
          class="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <span class="eeg-mono text-lg font-bold tabular-nums" [class.text-tone-danger]="urgent()">{{
        remaining()
      }}</span>
    </div>
  `,
})
export class CountdownRingComponent {
  readonly total = input.required<number>(); // Segundos totales
  readonly remaining = input.required<number>(); // Segundos que quedan
  protected readonly r = R;
  protected readonly c = C;
  protected readonly offset = computed(
    () => C * (1 - Math.max(0, this.remaining()) / Math.max(1, this.total())),
  );
  protected readonly urgent = computed(() => this.remaining() <= 5); // Últimos 5 s: además del número, cambia el color
}
