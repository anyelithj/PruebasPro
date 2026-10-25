import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { GamesFacade } from '../../application/games.facade';
import { ScenarioCardComponent } from '../components/scenario-card.component';
// [ScenarioListPage · Presentación · Sprint 8.9]: /juegos/role-play — escenarios por idioma y nivel (restaurante, entrevista, aeropuerto, médico, hotel, reunión) | [Patrón]: Container (smart) + filtros en signals | [Principio]: SRP + DIP | [Paradigma]: Declarativo + Reactivo
// [Responsive]: filtros en fila desde sm, tarjetas 1 → 2 → 3 columnas

@Component({
  selector: 'aula-scenario-list-page',
  imports: [
    BackLinkComponent,RouterLink, CardPageTemplate, ButtonComponent, SpinnerComponent, ScenarioCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().games;
    <aula-card-page [heading]="tx.scenarios" [subtitle]="tx.descriptions.role_play">
      <a aulaBackLink pageBack routerLink="/juegos">{{
        tx.backToHub
      }}</a>
      <form
        class="mb-5 grid gap-3 sm:grid-cols-[12rem_10rem_auto] sm:items-end"
        (submit)="$event.preventDefault(); load()"
      >
        <label class="text-xs font-semibold text-muted-foreground">
          {{ tx.language }}
          <select
            class="control mt-1 w-full"
            [value]="language()"
            (change)="language.set($any($event.target).value)"
          >
            @for (code of languages; track code) {
              <option [value]="code">{{ i18n.languageName(code) }}</option>
            }
          </select>
        </label>
        <label class="text-xs font-semibold text-muted-foreground">
          {{ tx.level }}
          <select
            class="control mt-1 w-full"
            [value]="levelSel()"
            (change)="levelSel.set($any($event.target).value)"
          >
            <option value="">{{ tx.anyLevel }}</option>
            @for (l of levels; track l) {
              <option [value]="l">{{ l }}</option>
            }
          </select>
        </label>
        <button aulaButton variant="outline" type="submit" class="justify-self-start">{{ tx.chooseScenario }}</button>
      </form>
      @switch (games.scenarios.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ games.scenarios.error() }}</p>
        }
        @case ('empty') {
          <p
            class="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
          >
            {{ tx.noScenarios }}
          </p>
        }
        @case ('success') {
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (s of games.scenarios.data()!; track s.id) {
              <li>
                <aula-scenario-card
                  [scenario]="s"
                  [roleLabel]="i18n.fmt(tx.agentRole, { role: s.role })"
                />
              </li>
            }
          </ul>
        }
      }
    </aula-card-page>
  `,
})
export default class ScenarioListPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  readonly lang = input<string>(); // ?lang= desde el hub
  readonly level = input<string>(); // ?level=
  protected readonly languages = LANGUAGES;
  protected readonly levels = CEFR_LEVELS;
  protected readonly language = signal('en');
  protected readonly levelSel = signal(''); // Nivel elegido en el filtro (se inicia con ?level=)

  constructor() {
    queueMicrotask(() => {
      if (this.lang()) this.language.set(this.lang()!);
      if (this.level()) this.levelSel.set(this.level()!);
      void this.load();
    });
  }

  protected load(): Promise<unknown> {
    return this.games.loadScenarios(this.language(), this.levelSel() || undefined);
  }
}
