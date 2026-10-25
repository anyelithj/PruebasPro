import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SECTION_META, type SectionWithExamples } from '../../domain/models/grammar';
import { ExampleLineComponent } from './example-line.component';
// [GrammarSectionComponent · Presentacional · Sprint 10.11 · RF-133]: sección con icono, color y nombre en español (uso, fórmula, negativa, interrogativa, nota, errores comunes) y sus ejemplos | [Patrón]: Presentational Component + Lookup Table (SECTION_META) | [Principio]: SRP + accesibilidad (el color nunca va solo: icono + texto) | [Paradigma]: Declarativo
// [Diseño]: la fórmula va en monoespaciada sobre una «píldora» para que se lea como patrón; el resto en párrafo con interlineado cómodo

@Component({
  selector: 'aula-grammar-section',
  imports: [IconComponent, ExampleLineComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <section class="overflow-hidden rounded-2xl border bg-card" [class]="borderTone()" [attr.aria-labelledby]="headId()">
      <h3 [id]="headId()" class="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide" [class]="meta().tone">
        <aula-icon [name]="meta().icon" />
        {{ section().title || typeLabel() }}
      </h3>
      <div class="space-y-3 px-4 py-3">
        @if (section().body) {
          @if (section().type === 'formula') {
            <p class="inline-block rounded-xl bg-muted px-3 py-2 font-mono text-sm font-semibold">{{ section().body }}</p>
          } @else {
            <p class="text-sm leading-relaxed">{{ section().body }}</p>
          }
        }
        @if (section().examples.length) {
          <ul class="space-y-2.5 border-l-2 border-tone-brand-line pl-3">
            @for (ex of section().examples; track ex.id) {
              <li>
                <aula-example-line
                  [example]="ex"
                  [language]="language()"
                  [showTranslation]="showTranslation()"
                  [listenLabel]="listenLabel()"
                  [unreviewedLabel]="unreviewedLabel()"
                />
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
})
export class GrammarSectionComponent {
  readonly section = input.required<SectionWithExamples>();
  readonly language = input('en');
  readonly typeLabel = input('');
  readonly showTranslation = input(true);
  readonly listenLabel = input('Escuchar el ejemplo');
  readonly unreviewedLabel = input('');

  protected readonly meta = computed(() => SECTION_META[this.section().type]);
  protected readonly borderTone = computed(() => this.meta().tone.split(' ')[0]); // Solo el color del borde
  protected readonly headId = computed(() => `gs-${this.section().id}`);
}
