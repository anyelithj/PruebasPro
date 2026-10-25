import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { AccentSwitchComponent } from '@shared/ui/molecules/accent-switch/accent-switch.component';
import { GrammarFacade } from '../../application/grammar.facade';
import { GrammarCardComponent } from '../components/grammar-card.component';
import { TranslationToggleComponent } from '../components/translation-toggle.component';
// [GrammarTopicPage · Presentación · Sprint 10.11 · RF-133/RF-134/RF-136]: /gramatica/:topicId — ficha con uso, fórmula, negativa, interrogativa, ejemplos y notas; IPA con interruptor UK/US en inglés, traducción visible por defecto y diccionario en cada palabra | [Patrón]: Container (smart) + Facade | [Principio]: SRP + accesibilidad | [Paradigma]: Declarativo + Reactivo

@Component({
  selector: 'aula-grammar-topic-page',
  imports: [
    BackLinkComponent,RouterLink, SpinnerComponent, AccentSwitchComponent, GrammarCardComponent, TranslationToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().grammar;
    <div class="w-full space-y-5 py-4">
      <nav class="flex flex-wrap items-center gap-2">
        <a aulaBackLink routerLink="/gramatica">{{ tx.back }}</a>
        <span class="ml-auto flex flex-wrap items-center gap-2">
          @if (g.topic.data()?.language === 'en') {
            <aula-accent-switch [label]="i18n.t().dictionary.accent" />
          }
          <aula-translation-toggle [(visible)]="g.showTranslation" [showLabel]="tx.showTranslation" [hideLabel]="tx.hideTranslation" />
        </span>
      </nav>
      @switch (g.topic.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="rounded-xl border border-tone-danger-line bg-tone-danger-soft p-4 text-sm text-tone-danger">{{ g.topic.error() }}</p>
        }
        @case ('success') {
          @if (g.topic.data(); as t) {
            <!-- [SEO/A11y]: un solo h1 por página (la portada de la ficha usa h2 dentro del artículo) -->
            <h1 class="sr-only">{{ tx.title }}: {{ t.title }}</h1>
            <aula-grammar-card
              [topic]="t"
              [languageName]="i18n.languageName(t.language ?? '')"
              [sectionLabels]="tx.sections"
              [showTranslation]="g.showTranslation()"
              [listenLabel]="tx.listen"
            />
          }
        }
      }
    </div>
  `,
})
export default class GrammarTopicPage {
  protected readonly i18n = inject(I18nService);
  protected readonly g = inject(GrammarFacade);
  readonly topicId = input<string>(); // `:topicId` de la ruta (withComponentInputBinding)

  constructor() {
    effect(() => {
      const id = this.topicId();
      if (id) void this.g.loadTopic(id);
    });
  }
}
