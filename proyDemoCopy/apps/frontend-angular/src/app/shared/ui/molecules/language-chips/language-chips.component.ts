import { ChangeDetectionStrategy, Component, inject, input, model } from '@angular/core';
import { LANGUAGES } from '@aula/shared-schemas';
import { I18nService } from '@core/i18n/i18n.service';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
// [LanguageChipsComponent · Molécula · 2026-10-27]: pestañas de idioma («✦ Todos» + «EN Inglés», «FR Francés»…) — la MISMA clasificación del catálogo de Cursos de Next.js (<LanguageChips>) en las actividades del remoto
// [Patrón]: Atomic Design (molécula) + Two-way binding (`model()`) | [Principio]: DRY (mismo .chip y SSOT LANGUAGES) + SRP (solo elige el idioma) | [Paradigma]: Declarativo + Reactivo (Signals)
// [A11y]: <div role="group"> con aria-label + <button aria-pressed> → el estado no depende solo del color (el .chip pinta el degradado con aria-pressed="true")

@Component({
  selector: 'aula-language-chips',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div role="group" [attr.aria-label]="label()" class="flex flex-wrap gap-1.5">
      @if (allowAll()) {
        <button type="button" class="chip" [attr.aria-pressed]="!value()" (click)="value.set('')">
          <aula-icon name="sparkles" /> {{ allLabel() }}
        </button>
      }
      @for (c of languages; track c) {
        <!-- [Toggle]: pulsar el activo vuelve a «Todos» (como en Cursos) solo si «Todos» existe -->
        <button type="button" class="chip" [attr.aria-pressed]="value() === c" (click)="value.set(value() === c && allowAll() ? '' : c)">
          <span aria-hidden="true" class="font-mono">{{ c.toUpperCase() }}</span> {{ i18n.languageName(c) }}
        </button>
      }
    </div>
  `,
})
export class LanguageChipsComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly languages = LANGUAGES;
  // `model()` (Angular 17.2+): input + output en un signal → [(value)]="language" desde el padre | '' = todos
  readonly value = model<string>('');
  readonly label = input.required<string>(); // Nombre accesible del grupo
  readonly allLabel = input(''); // Texto del chip «Todos»
  readonly allowAll = input(true); // false → siempre hay un idioma elegido (p. ej. Lectura)
}
