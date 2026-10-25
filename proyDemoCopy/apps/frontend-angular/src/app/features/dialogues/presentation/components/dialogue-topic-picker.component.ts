import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
// [DialogueTopicPickerComponent · Presentacional · Sprint 9.11 · RF-121]: elegir el idioma (siete) y el nivel con los que se conversa y se filtran los temas y la biblioteca | [Patrón]: Presentational Component + Two-way binding (`model`) | [Principio]: SRP + DRY (hub y biblioteca) | [Paradigma]: Declarativo
// [A11y]: <select> nativos con etiqueta visible

@Component({
  selector: 'aula-dialogue-topic-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="grid gap-3 rounded-xl bg-muted p-3 sm:grid-cols-2">
      <label class="text-xs font-semibold text-muted-foreground">
        {{ languageLabel() }}
        <select
          class="control mt-1 w-full bg-card"
          [value]="language()"
          (change)="language.set($any($event.target).value)"
        >
          @for (code of languages; track code) {
            <option [value]="code">{{ names()[code] ?? code }}</option>
          }
        </select>
      </label>
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
  protected readonly languages = LANGUAGES;
  protected readonly levels = CEFR_LEVELS;
}
