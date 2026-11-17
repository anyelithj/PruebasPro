import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { CEFR_LEVELS } from '@aula/shared-schemas';
import { LanguageChipsComponent } from '@shared/ui/molecules/language-chips/language-chips.component';
// [DialogueTopicPickerComponent · Presentacional · Sprint 9.11 · RF-121]: elegir el idioma (siete) y el nivel con los que se conversa y se filtran los temas y la biblioteca | [Patrón]: Presentational Component + Two-way binding (`model`) | [Principio]: SRP + DRY (hub y biblioteca) | [Paradigma]: Declarativo
// [A11y]: <select> nativos con etiqueta visible

@Component({
  selector: 'aula-dialogue-topic-picker',
  imports: [LanguageChipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <!-- [2026-11-03 · Diseño común de Actividades]: pills de idioma + caja gris con los selects (como Lectura, Música, Juegos y Práctica) | <ng-content>: filtros extra (tema en Biblioteca) -->
    <aula-language-chips class="mb-3" [(value)]="language" [label]="languageLabel()" [allowAll]="false" />
    <div class="grid gap-3 rounded-xl bg-muted p-3 sm:grid-cols-2">
      <label class="text-xs font-semibold text-muted-foreground">
        {{ levelLabel() }}
        <select
          class="control mt-1 w-full bg-card"
          [value]="level()"
          (change)="level.set($any($event.target).value)"
        >
          @if (allowAny()) {
            <option value="">{{ anyLabel() }}</option>
          }
          @for (l of levels; track l) {
            <option [value]="l">{{ l }}</option>
          }
        </select>
      </label>
      <ng-content />
    </div>
  `,
})
export class DialogueTopicPickerComponent {
  readonly language = model('en');
  readonly level = model('A2');
  readonly languageLabel = input.required<string>();
  readonly levelLabel = input.required<string>();
  readonly anyLabel = input('');
  readonly allowAny = input(false);
  readonly names = input<Record<string, string>>({});
  protected readonly levels = CEFR_LEVELS;
}
