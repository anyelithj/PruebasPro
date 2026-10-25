import { ChangeDetectionStrategy, Component, input } from '@angular/core';
// [MetricCardComponent · Presentacional · Sprint 8.11]: una métrica de fluidez (tiempo hasta responder, continuidad, palabras, vocabulario reutilizado) | [Patrón]: Presentational Component (KPI tile) | [Principio]: SRP + DRY (panel de fluidez, resultado de partida y rondas orales) | [Paradigma]: Declarativo
// [Jerarquía]: cifra grande con `tabular-nums`, etiqueta arriba, pista debajo · [A11y]: <dl> semántico (término → valor)

@Component({
  selector: 'aula-metric-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <dl class="surface h-full p-4">
      <dt class="text-xs font-semibold text-muted-foreground">{{ label() }}</dt>
      <dd class="mt-1 text-2xl font-extrabold tabular-nums tracking-tight">{{ value() }}</dd>
      @if (hint()) {
        <dd class="mt-0.5 text-xs text-muted-foreground">{{ hint() }}</dd>
      }
    </dl>
  `,
})
export class MetricCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly hint = input('');
}
