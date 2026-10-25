import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent, type IconName } from '../icon/icon.component';
// [BadgeComponent · Átomo compuesto]: etiqueta de estado con texto + icono (nunca solo color, WCAG 1.4.1) | [Patrón]: Atomic Design + Lookup Table (tono → clases) | [Principio]: DRY (usa las utilidades `badge` y `tone-*` del sistema de diseño compartido)

export type BadgeTone = 'brand' | 'info' | 'warning' | 'danger' | 'muted';

// [Tonos]: clases Tailwind de globals.css (se adaptan a los 6 temas)
const TONES: Record<BadgeTone, string> = {
  brand: 'bg-tone-brand-soft text-tone-brand',
  info: 'bg-tone-info-soft text-tone-info',
  warning: 'bg-tone-warning-soft text-tone-warning',
  danger: 'bg-tone-danger-soft text-tone-danger',
  muted: 'bg-muted text-muted-foreground',
};

@Component({
  selector: 'aula-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="classes()">
      @if (icon(); as name) {
        <aula-icon [name]="name" [size]="12" />
      }
      <ng-content />
    </span>
  `,
})
export class BadgeComponent {
  readonly tone = input<BadgeTone>('muted');
  readonly icon = input<IconName | null>(null);
  protected readonly classes = computed(() => `badge ${TONES[this.tone()]}`);
}
