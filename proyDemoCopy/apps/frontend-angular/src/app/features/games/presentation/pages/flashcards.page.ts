import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { GamesFacade } from '../../application/games.facade';
import { FlashcardComponent } from '../components/flashcard.component';
// [FlashcardsPage · Presentación · Sprint 8.8]: /juegos/flashcards — tarjetas vencidas hoy del mazo SM-2 (repetición espaciada sobre el banco de vocabulario propio) | [Patrón]: Container (smart) + State Machine (cargando → tarjeta → vacío) | [Principio]: SRP + DIP | [Paradigma]: Declarativo + Reactivo
// [Pedagogía]: se pide recordar antes de mostrar la respuesta; la calidad 0–5 la usa NestJS (SM-2) para agendar la próxima repetición
// [Vacío]: ofrece llenar el mazo con todo tu vocabulario o ir al traductor a guardar palabras

@Component({
  selector: 'aula-flashcards-page',
  imports: [
    BackLinkComponent,RouterLink, CardPageTemplate, ButtonComponent, SpinnerComponent, FlashcardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().games;
    <aula-card-page [heading]="tx.names.flashcards" [subtitle]="tx.descriptions.flashcards">
      <a aulaBackLink pageBack routerLink="/juegos">{{
        tx.backToHub
      }}</a>
      @if (games.error(); as err) {
        <p role="alert" class="mb-3 text-sm text-tone-danger">{{ err }}</p>
      }
      @switch (games.due.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ games.due.error() }}</p>
        }
        @case ('success') {
          @let card = current()!;
          <p class="mb-3 text-sm font-semibold" aria-live="polite">
            {{ i18n.fmt(tx.deckDue, { n: games.due.data()!.length }) }}
          </p>
          <aula-flashcard
            [front]="card.entry.term"
            [back]="card.entry.translation"
            [example]="card.entry.example"
            [language]="card.entry.language"
            [cardKey]="card.id"
            [busy]="games.busy()"
            [question]="tx.whatMeans"
            [recallHint]="tx.recallFirst"
            [revealLabel]="tx.reveal"
            [howWellLabel]="tx.howWell"
            [qualityLabels]="tx.quality"
            (graded)="games.review(card, $event)"
          />
        }
        @default {
          <div class="space-y-3 rounded-xl border border-dashed border-border p-6 text-center">
            <p class="text-lg font-semibold">{{ tx.deckEmpty }}</p>
            @if (filled() !== null) {
              <p role="status" class="text-sm text-tone-brand">
                {{ i18n.fmt(tx.deckFilled, { n: filled()! }) }}
              </p>
            }
            <div class="flex flex-wrap justify-center gap-2">
              <button aulaButton type="button" [loading]="games.busy()" (click)="fill()">
                {{ tx.deckFill }}
              </button>
              <a aulaButton variant="outline" routerLink="/traductor">{{
                i18n.t().vocabulary.openTranslator
              }}</a>
            </div>
          </div>
        }
      }
    </aula-card-page>
  `,
})
export default class FlashcardsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  protected readonly filled = signal<number | null>(null);
  protected readonly current = computed(() => this.games.due.data()?.[0] ?? null); // Siempre la primera vencida

  constructor() {
    void this.games.loadDue();
  }

  protected async fill(): Promise<void> {
    this.filled.set(await this.games.fillDeck());
  }
}
