import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TOPIC_CATEGORIES, type Topic, type TopicCategory } from '../../domain/models/polyglot';
// [PolyglotTopicPickerComponent · Presentacional · Sprint 10.7 · RF-129]: elegir el tema con UN SELECT POR CATEGORÍA (vocabulario: familia, animales, comida… · frases: saludos, despedidas, en el médico… · números · gramática) | [Patrón]: Presentational Component + Grouping (Map por categoría) | [Principio]: SRP + escalabilidad (con muchos temas los botones no cabían) | [Paradigma]: Declarativo + Funcional
// [2026-10-19]: antes era un grupo de botones con todos los temas mezclados; ahora solo se compara lo comparable dentro de cada categoría
// [A11y]: cada select con etiqueta visible · el tema elegido se ve en su select y los demás vuelven a «Elige…» · <select> nativo (teclado y lector de pantalla sin código extra)

export interface CategoryLabels {
  choose: string; // «Elige un tema…»
  categories: Record<TopicCategory, string>; // «📚 Vocabulario»…
}

@Component({
  selector: 'aula-polyglot-topic-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="group" [attr.aria-label]="label()" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      @for (g of groups(); track g.category) {
        <label class="text-xs font-semibold text-muted-foreground">
          {{ labels().categories[g.category] }}
          <select
            class="control mt-1 w-full text-sm font-semibold text-foreground"
            [class.border-primary]="g.selected"
            [class.ring-2]="g.selected"
            [class.ring-primary]="g.selected"
            [value]="g.selected ? selected() : ''"
            (change)="$any($event.target).value && picked.emit($any($event.target).value)"
          >
            <option value="">{{ labels().choose }}</option>
            @for (t of g.topics; track t.id) {
              <option [value]="t.id">
                {{ t.emoji }} {{ t.title }}{{ showStatus() && t.status === 'draft' ? ' · ' + draftLabel() : '' }}
              </option>
            }
          </select>
        </label>
      }
    </div>
  `,
})
export class PolyglotTopicPickerComponent {
  readonly topics = input.required<Topic[]>();
  readonly selected = input<string | null>(null);
  readonly label = input('Tema');
  readonly labels = input.required<CategoryLabels>();
  readonly showStatus = input(false); // El personal ve qué temas siguen en borrador
  readonly draftLabel = input('Borrador');
  readonly picked = output<string>();

  // [groups]: categorías con al menos un tema, en el orden de TOPIC_CATEGORIES | `filter` + `map` (ES5) | [Paradigma]: Funcional (derivado, sin estado)
  protected readonly groups = computed(() =>
    TOPIC_CATEGORIES.map((category) => {
      const topics = this.topics().filter((t) => t.category === category);
      return { category, topics, selected: topics.some((t) => t.id === this.selected()) };
    }).filter((g) => g.topics.length > 0),
  );
}
