import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import { GamesRepository, type GameDeck } from '../../domain/games.repository.port';
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
        <p role="alert" class="mb-3 text-tone-danger">{{ err }}</p>
      }
      <!-- [Tema · 2026-11-11]: tu repaso (SM-2) o un juego de flashcards del docente → el estudiante elige qué practicar -->
      <label class="mb-4 block max-w-sm text-xs font-semibold text-muted-foreground">
        {{ tx.theme }}
        <select class="control mt-1 w-full" [value]="deckId()" (change)="pickDeck($any($event.target).value)">
          <option value="">{{ tx.myReview }}</option>
          @if (decks().length) {
            <optgroup [label]="tx.themeDecks">
              @for (d of decks(); track d.id) {
                <option [value]="d.id">{{ d.title }} · {{ i18n.languageName(d.language) }}{{ d.level ? ' · ' + d.level : '' }}</option>
              }
            </optgroup>
          }
        </select>
      </label>
      @if (deck(); as dk) {
        @if (deckCard(); as c) {
          <p class="mb-3 font-semibold" aria-live="polite">{{ deckIndex() + 1 }} / {{ dk.items.length }}</p>
          <aula-flashcard
            [front]="c.term"
            [back]="(c.emoji ? c.emoji + ' ' : '') + (c.translation ?? '')"
            [language]="dk.language"
            [cardKey]="dk.id + deckIndex()"
            [question]="tx.whatMeans"
            [recallHint]="tx.recallFirst"
            [revealLabel]="tx.reveal"
            [howWellLabel]="tx.howWell"
            [qualityLabels]="tx.quality"
            (graded)="deckIndex.set(deckIndex() + 1)"
          />
        } @else {
          <div role="status" class="space-y-3 rounded-xl border border-dashed border-border p-6 text-center">
            <p class="type-lead font-semibold">{{ tx.gameOver }}</p>
            <button aulaButton type="button" (click)="deckIndex.set(0)">{{ tx.playAgain }}</button>
          </div>
        }
      } @else {
      @switch (games.due.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-tone-danger">{{ games.due.error() }}</p>
        }
        @case ('success') {
          @let card = current()!;
          <p class="mb-3 font-semibold" aria-live="polite">
            {{ i18n.fmt(tx.deckDue, { n: games.due.data()!.length }) }}
          </p>
          <aula-flashcard
            [front]="card.entry.grammar?.headword || card.entry.term"
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
            <p class="type-lead font-semibold">{{ tx.deckEmpty }}</p>
            @if (filled() !== null) {
              <p role="status" class="text-tone-brand">
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
      }
    </aula-card-page>
  `,
})
export default class FlashcardsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  protected readonly filled = signal<number | null>(null);
  protected readonly current = computed(() => this.games.due.data()?.[0] ?? null); // Siempre la primera vencida

  // [Juegos del docente · 2026-11-11]: antes ?mazo= se ignoraba aquí (solo SM-2) → ahora se elige y se repasa en el cliente (sin agenda SM-2)
  private readonly repo = inject(GamesRepository);
  private readonly route = inject(ActivatedRoute);
  protected readonly decks = toSignal(
    this.repo.decks().pipe(map((ds) => ds.filter((d) => d.gameType === 'flashcards')), catchError(() => of([] as GameDeck[]))),
    { initialValue: [] as GameDeck[] },
  );
  protected readonly deckId = signal(this.route.snapshot.queryParamMap.get('mazo') ?? '');
  protected readonly deckIndex = signal(0);
  protected readonly deck = computed(() => this.decks().find((d) => d.id === this.deckId()) ?? null);
  protected readonly deckCard = computed(() => this.deck()?.items[this.deckIndex()] ?? null);

  constructor() {
    void this.games.loadDue();
  }

  protected pickDeck(id: string): void {
    this.deckId.set(id);
    this.deckIndex.set(0);
  }

  protected async fill(): Promise<void> {
    this.filled.set(await this.games.fillDeck());
  }
}
