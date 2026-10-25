import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LevelTintDirective } from '@shared/ui/atoms/level-tint/level-tint.directive';
// [LevelBadgeComponent · Presentacional · Sprint 9.11 · RF-126]: nivel A1–C2 «estimado» o «confirmado» con el color del nivel MCER | [Patrón]: Presentational Component | [Principio]: verificación humana visible (una estimación nunca se presenta como verdad) | [Paradigma]: Declarativo
// [A11y]: el estado va en texto (✓ / ≈), el color es decorativo

@Component({
  selector: 'aula-level-badge',
  imports: [LevelTintDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      [aulaLevel]="level()"
      class="badge border font-bold"
      [class]="
        status() === 'confirmed'
          ? 'border-(--lvl) bg-(--lvl) text-white'
          : 'border-dashed border-(--lvl) text-foreground'
      "
    >
      <span aria-hidden="true">{{ status() === 'confirmed' ? '✓' : '≈' }}</span>
      {{ text() }}
    </span>
  `,
})
export class LevelBadgeComponent {
  readonly level = input<string | null>(null);
  readonly status = input<'estimated' | 'confirmed'>('estimated');
  readonly labels = input.required<{ estimated: string; confirmed: string; none: string }>();
  protected readonly text = computed(() =>
    this.level()
      ? this.labels()[this.status()].replace('{level}', this.level()!)
      : this.labels().none,
  );
}
