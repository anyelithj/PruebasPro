import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
// [FormFieldComponent · Molécula]: etiqueta + control proyectado + ayuda/error asociados por id | [Patrón]: Atomic Design (molécula = átomos) + Content Projection | [Principio]: SRP (el control no sabe de etiquetas) + DRY
// [A11y]: <label for> enlaza el control · el error usa role="alert" y su id va en `aria-describedby` del control (`describedBy()` se lo pasa la página)

@Component({
  selector: 'aula-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block space-y-1.5' },
  template: `
    <div class="flex items-baseline justify-between gap-2">
      <label class="text-sm font-semibold" [attr.for]="fieldId()">{{ label() }}</label>
      <!-- [Contador / extra]: proyección con nombre (p. ej. «12 palabras») -->
      <ng-content select="[fieldAside]" />
    </div>
    <ng-content />
    @if (error()) {
      <p class="text-xs text-tone-danger" role="alert" [id]="errorId()">{{ error() }}</p>
    } @else if (hint()) {
      <p class="text-xs text-muted-foreground" [id]="hintId()">{{ hint() }}</p>
    }
  `,
})
export class FormFieldComponent {
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly error = input('');

  readonly hintId = computed(() => `${this.fieldId()}-hint`);
  readonly errorId = computed(() => `${this.fieldId()}-error`);
  // [describedBy]: id que el control debe anunciar (error tiene prioridad sobre ayuda)
  readonly describedBy = computed(() => (this.error() ? this.errorId() : this.hint() ? this.hintId() : ''));
}
