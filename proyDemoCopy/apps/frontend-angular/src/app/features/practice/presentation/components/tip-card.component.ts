import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
// [TipCardComponent · Presentacional · Sprint 8.14]: consejo del ítem (cómo no repetir el error) | [Patrón]: Presentational Component | [Principio]: SRP | [Paradigma]: Declarativo
// [Identidad]: tono informativo (no de error) para que el consejo se lea como ayuda · [A11y]: <aside> con título

@Component({
  selector: 'aula-tip-card',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <aside
      class="rounded-xl border border-tone-info-line bg-tone-info-soft p-3 text-sm text-tone-info"
    >
      <p class="font-bold"><aula-icon name="lightbulb" /> {{ title() }}</p>
      <p class="mt-1 text-foreground">{{ text() }}</p>
    </aside>
  `,
})
export class TipCardComponent {
  readonly title = input('Consejo');
  readonly text = input.required<string>();
}
