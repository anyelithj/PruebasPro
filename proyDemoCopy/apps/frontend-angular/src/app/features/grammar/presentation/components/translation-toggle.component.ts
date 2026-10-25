import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
// [TranslationToggleComponent · Presentacional · Sprint 10.11 · RF-134]: mostrar u ocultar la traducción de los ejemplos (visible por defecto) | [Patrón]: Presentational Component con `model()` (two-way binding) | [Principio]: SRP + accesibilidad (botón con `aria-pressed` y texto que dice lo que hará) | [Paradigma]: Declarativo

@Component({
  selector: 'aula-translation-toggle',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="btn btn-outline btn-sm" [attr.aria-pressed]="visible()" (click)="visible.set(!visible())">
      <aula-icon [name]="visible() ? 'eye-off' : 'eye'" />
      {{ visible() ? hideLabel() : showLabel() }}
    </button>
  `,
})
export class TranslationToggleComponent {
  readonly visible = model(true);
  readonly showLabel = input('Mostrar traducción');
  readonly hideLabel = input('Ocultar traducción');
}
