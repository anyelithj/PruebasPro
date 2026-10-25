import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
// [ModeSwitchComponent · Molécula · 2026-10-19]: control segmentado «¿Cómo lo quieres hacer?» (Automático con IA / Manual / Desde una URL…) | [Patrón]: Atomic Design (molécula) + Two-way binding (`model`) | [Principio]: DRY (letra y sincronización de canciones, diálogos) + SRP | [Paradigma]: Declarativo
// [A11y]: <fieldset> + <legend> y radios nativos (flechas del teclado entre opciones) · la opción activa se distingue por borde, fondo y ✓ (no solo color) · objetivo táctil 44 px

export interface ModeOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string; // Qué hace esa opción (una línea)
}

@Component({
  selector: 'aula-mode-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <fieldset class="space-y-2">
      <legend class="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{{ legend() }}</legend>
      <div class="grid gap-2" [class]="options().length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
        @for (o of options(); track o.value) {
          <label
            class="flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring"
            [class]="value() === o.value ? 'border-primary bg-tone-brand-soft text-tone-brand' : 'border-border hover:border-primary/60'"
          >
            <input type="radio" class="mt-0.5 size-4 accent-violet-600" [name]="name()" [value]="o.value" [checked]="value() === o.value" (change)="value.set(o.value)" />
            <span class="min-w-0">
              <span class="block font-bold">{{ value() === o.value ? '✓ ' : '' }}{{ o.label }}</span>
              @if (o.hint) {
                <span class="block text-xs text-muted-foreground">{{ o.hint }}</span>
              }
            </span>
          </label>
        }
      </div>
    </fieldset>
  `,
})
export class ModeSwitchComponent {
  readonly legend = input.required<string>();
  readonly name = input.required<string>(); // Grupo de radios (único en la página)
  readonly options = input.required<readonly ModeOption[]>();
  readonly value = model.required<string>(); // [(value)]
}
