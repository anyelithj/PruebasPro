import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
// [MultipleChoiceComponent · Presentacional · Sprint 8.14]: opción múltiple con radios nativos | [Patrón]: Presentational Component (emite la respuesta, no corrige) | [Principio]: SRP | [Paradigma]: Declarativo
// [A11y]: <fieldset> + <legend> con el enunciado, radios nativos (flechas del teclado), opción elegida con borde + icono, no solo color · objetivo táctil amplio (toda la fila es la etiqueta)

@Component({
  selector: 'aula-multiple-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <fieldset class="space-y-2" [disabled]="disabled()">
      <legend class="mb-2 text-lg font-semibold" [attr.lang]="language()">{{ prompt() }}</legend>
      @for (o of options(); track o) {
        <label
          class="flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-tone-brand-soft"
          [class.border-border]="picked() !== o"
        >
          <input
            type="radio"
            class="size-4 accent-[var(--btn-solid)]"
            [name]="name()"
            [value]="o"
            [checked]="picked() === o"
            (change)="pick(o)"
          />
          <span [attr.lang]="language()">{{ o }}</span>
        </label>
      }
    </fieldset>
  `,
})
export class MultipleChoiceComponent {
  readonly prompt = input.required<string>();
  readonly options = input.required<string[]>();
  readonly name = input('mc'); // `name` del grupo de radios (único por ítem)
  readonly language = input('en');
  readonly disabled = input(false);
  readonly changed = output<string[]>();
  protected readonly picked = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.name(); // Ítem nuevo → sin selección
      untracked(() => this.picked.set(null));
    });
  }

  protected pick(o: string): void {
    this.picked.set(o);
    this.changed.emit([o]);
  }
}
