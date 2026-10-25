import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { SectionType, TopicDetail } from '../../domain/models/grammar';
import { GrammarSectionComponent } from './grammar-section.component';
// [GrammarCardComponent · Presentacional · Sprint 10.11 · RF-133/RF-134]: la ficha completa de un tema — encabezado con nivel e idioma, resumen y sus secciones en orden (como la imagen de referencia) | [Patrón]: Presentational Component + Composition | [Principio]: SRP + DRY (el visor y la vista previa del editor usan la misma ficha) | [Paradigma]: Declarativo
// [Diseño]: cabecera con el degradado morado de marca (uso estratégico: solo la portada de la ficha) y secciones en rejilla de dos columnas en escritorio

@Component({
  selector: 'aula-grammar-card',
  imports: [GrammarSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="space-y-4">
      <header class="rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-5 text-white shadow-lg shadow-primary/20">
        <p class="text-xs font-bold uppercase tracking-widest opacity-90">{{ languageName() }} · {{ topic().levels.join(', ') }}</p>
        <h2 class="mt-1 text-2xl font-extrabold sm:text-3xl" [attr.lang]="topic().language">{{ topic().title }}</h2>
        @if (topic().summary) {
          <p class="mt-1 text-sm opacity-95">{{ topic().summary }}</p>
        }
      </header>
      <div class="grid gap-4 lg:grid-cols-2">
        @for (s of topic().sections; track s.id) {
          <aula-grammar-section
            [section]="s"
            [language]="topic().language ?? 'en'"
            [typeLabel]="sectionLabels()[s.type]"
            [showTranslation]="showTranslation()"
            [listenLabel]="listenLabel()"
            [unreviewedLabel]="unreviewedLabel()"
          />
        }
      </div>
    </article>
  `,
})
export class GrammarCardComponent {
  readonly topic = input.required<TopicDetail>();
  readonly languageName = input('');
  readonly sectionLabels = input.required<Record<SectionType, string>>();
  readonly showTranslation = input(true);
  readonly listenLabel = input('Escuchar el ejemplo');
  readonly unreviewedLabel = input('');
}
