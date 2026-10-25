import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
// [RoleSelectorComponent · Presentacional · Sprint 9.13 · RF-127]: practicar el diálogo como hablante A o B | [Patrón]: Presentational Component + Two-way binding (`model`) | [Principio]: SRP | [Paradigma]: Declarativo
// [A11y]: grupo de radio con nombre (WAI-ARIA Radio Group) · el elegido lleva el degradado de marca y `aria-checked`

@Component({
  selector: 'aula-role-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="radiogroup"
      [attr.aria-label]="label()"
      class="inline-flex flex-wrap items-center gap-2"
    >
      <span class="text-sm font-semibold">{{ label() }}</span>
      @for (s of sides; track s; let i = $index) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="role() === s"
          class="min-h-11 rounded-full border px-4 text-sm font-bold transition-colors"
          [class]="
            role() === s
              ? 'border-transparent bg-gradient-brand text-white'
              : 'border-border text-muted-foreground hover:border-primary'
          "
          (click)="role.set(s)"
        >
          {{ speakers()[i] || s }}
        </button>
      }
    </div>
  `,
})
export class RoleSelectorComponent {
  readonly role = model<'A' | 'B'>('A');
  readonly speakers = input<readonly string[]>(['A', 'B']);
  readonly label = input.required<string>();
  protected readonly sides = ['A', 'B'] as const;
}
