import type { IconName } from '@shared/ui/atoms/icon/icon.component';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
// [ErrorBadgeComponent · Presentacional · Sprint 8.14]: tipo de error con icono + texto (gramática, vocabulario, ortografía, puntuación, orden, estilo) | [Patrón]: Atomic Design (átomo compuesto) + Lookup Table (tipo → icono) | [Principio]: SRP + DRY | [Paradigma]: Declarativo
// [A11y]: WCAG 1.4.1 — el tipo se lee en texto; el icono es decorativo y el color solo refuerza

const ICON: Readonly<Record<string, IconName>> = {
  grammar: 'languages',
  vocabulary: 'book-open',
  spelling: 'pencil',
  punctuation: 'circle-alert',
  word_order: 'shuffle',
  style: 'palette',
};

@Component({
  selector: 'aula-error-badge',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge bg-tone-danger-soft text-tone-danger"
    ><aula-icon [name]="icon()" /> {{ label() }}</span
  >`,
})
export class ErrorBadgeComponent {
  readonly type = input.required<string>();
  readonly label = input.required<string>(); // Texto traducido del tipo
  protected readonly icon = computed(() => ICON[this.type()] ?? 'triangle-alert');
}
