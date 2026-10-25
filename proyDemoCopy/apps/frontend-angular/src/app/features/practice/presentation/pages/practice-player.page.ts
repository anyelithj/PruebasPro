import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { PracticeFacade } from '../../application/practice.facade';
import { DragOrderComponent } from '../components/drag-order.component';
import { ErrorBadgeComponent } from '../components/error-badge.component';
import { FeedbackPanelComponent } from '../components/feedback-panel.component';
import { FillBlankComponent } from '../components/fill-blank.component';
import { MarkErrorsComponent } from '../components/mark-errors.component';
import { MatchPairsComponent } from '../components/match-pairs.component';
import { MultipleChoiceComponent } from '../components/multiple-choice.component';
import { ActivityContentsComponent } from '../components/activity-contents.component';
// [PracticePlayerPage · Presentación · Sprint 8.14]: /practica/:activityId — resolver ítem a ítem (opción múltiple, huecos, emparejar, ordenar, marcar errores, respuesta abierta) con la corrección DEBAJO del ejercicio y resumen final | [Patrón]: Container (smart) + Strategy (componente por tipo de ítem) + State Machine (respondiendo → corregido → siguiente → resultado) | [Principio]: SRP + OCP (tipo nuevo = un @case) + DIP | [Paradigma]: Declarativo + Reactivo
// [A11y]: progreso en texto, el ejercicio se bloquea tras comprobar, el panel de corrección se anuncia (role="status") · [Responsive]: una columna, botones grandes

@Component({
  selector: 'aula-practice-player-page',
  imports: [IconComponent, 
    BackLinkComponent,
    ActivityContentsComponent,
    RouterLink,
    CardPageTemplate,
    ButtonComponent,
    SpinnerComponent,
    MultipleChoiceComponent,
    FillBlankComponent,
    MatchPairsComponent,
    DragOrderComponent,
    MarkErrorsComponent,
    FeedbackPanelComponent,
    ErrorBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().practice;
    @switch (facade.activity.status()) {
      @case ('loading') {
        <aula-spinner [label]="i18n.t().common.loading" />
      }
      @case ('error') {
        <aula-card-page [heading]="tx.title">
          <p role="alert" class="text-sm text-tone-danger">{{ facade.activity.error() }}</p>
        </aula-card-page>
      }
      @case ('success') {
        @let a = facade.activity.data()!;
        <aula-card-page
          [heading]="a.title"
          [subtitle]="a.level + ' · ' + tx.skills[a.skill] + ' · ' + i18n.languageName(a.language)"
        >
          <a aulaBackLink pageBack routerLink="/practica">{{
            tx.backToList
          }}</a>
          <!-- [2026-10-23]: material de la actividad (vocabulario, juego, canción…) antes de los ejercicios -->
          @if (a.contents.length) {
            <aula-activity-contents class="mb-4" [contents]="a.contents" [labels]="tx.contents" />
          }
          @if (facade.done()) {
            <!-- ───── Resultado ───── -->
            <div class="space-y-4 text-center" role="status">
              <aula-icon class="mx-auto text-tone-brand" [name]="facade.score() >= 70 ? 'trophy' : 'biceps-flexed'" [size]="48" />
              <h2 class="text-xl font-extrabold">{{ tx.resultTitle }}</h2>
              <p class="text-lg">{{ i18n.fmt(tx.resultScore, { pct: facade.score() }) }}</p>
              <!-- [RF-113]: resumen de los errores más frecuentes de la sesión (tipo con icono + texto + veces) -->
              <section class="mx-auto max-w-md text-left" [attr.aria-label]="tx.frequentErrors">
                <h3 class="mb-2 text-sm font-bold">{{ tx.frequentErrors }}</h3>
                @for (e of facade.frequentErrors(); track e.type) {
                  <p
                    class="flex items-center justify-between gap-2 border-b border-border py-1 text-sm"
                  >
                    <aula-error-badge [type]="e.type" [label]="errorLabel(e.type)" />
                    <span class="font-semibold tabular-nums">× {{ e.count }}</span>
                  </p>
                } @empty {
                  <p class="text-sm text-tone-brand">{{ tx.noErrors }}</p>
                }
              </section>
              <div class="flex flex-wrap justify-center gap-2">
                <button aulaButton type="button" (click)="facade.restart()">{{ tx.retry }}</button>
                <a aulaBackLink routerLink="/practica">{{ tx.backToList }}</a>
              </div>
            </div>
          } @else if (facade.item(); as it) {
            <!-- ───── Ejercicio ───── -->
            <div class="mb-4 flex items-center justify-between gap-2">
              <p class="text-sm font-semibold" aria-live="polite">
                {{ i18n.fmt(tx.itemOf, { n: facade.index() + 1, total: facade.total() }) }}
              </p>
              <span class="badge bg-tone-brand-soft text-tone-brand">{{
                tx.types[it.itemType]
              }}</span>
            </div>
            <!-- [Barra de progreso]: degradado de marca; el valor también va en texto arriba -->
            <div
              class="mb-5 h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              [attr.aria-valuenow]="facade.index()"
              aria-valuemin="0"
              [attr.aria-valuemax]="facade.total()"
            >
              <div
                class="h-full bg-gradient-brand transition-[width] duration-500"
                [style.width.%]="(facade.index() / facade.total()) * 100"
              ></div>
            </div>
            @let locked = !!facade.attempt();
            <div class="space-y-4">
              @switch (it.itemType) {
                @case ('multiple_choice') {
                  <aula-multiple-choice
                    [prompt]="it.prompt"
                    [options]="it.options"
                    [name]="'mc-' + it.id"
                    [language]="a.language"
                    [disabled]="locked"
                    (changed)="answer.set($event)"
                  />
                }
                @case ('fill_blank') {
                  <aula-fill-blank
                    [prompt]="it.prompt"
                    [language]="a.language"
                    [disabled]="locked"
                    [blankLabel]="tx.blank"
                    (changed)="answer.set($event)"
                  />
                }
                @case ('match_pairs') {
                  <aula-match-pairs
                    [prompt]="it.prompt"
                    [options]="it.options"
                    [language]="a.language"
                    [disabled]="locked"
                    [pairLabel]="tx.pairFor"
                    [chooseLabel]="tx.choose"
                    (changed)="answer.set($event)"
                  />
                }
                @case ('drag_order') {
                  <p class="text-lg font-semibold">{{ it.prompt }}</p>
                  <aula-drag-order
                    [tiles]="it.options"
                    [language]="a.language"
                    [disabled]="locked"
                    [hint]="tx.orderHint"
                    [upLabel]="tx.moveUp"
                    [downLabel]="tx.moveDown"
                    (changed)="answer.set($event)"
                  />
                }
                @case ('mark_errors') {
                  <aula-mark-errors
                    [text]="it.prompt"
                    [language]="a.language"
                    [disabled]="locked"
                    [hint]="tx.markHint"
                    [countLabel]="tx.marked"
                    (changed)="answer.set($event)"
                  />
                }
                @default {
                  <label class="block">
                    <span class="mb-2 block text-lg font-semibold">{{ it.prompt }}</span>
                    <textarea
                      class="control w-full"
                      rows="4"
                      [attr.lang]="a.language"
                      [attr.placeholder]="tx.openHint"
                      [disabled]="locked"
                      (input)="answer.set([$any($event.target).value])"
                    ></textarea>
                  </label>
                }
              }
              @if (facade.error(); as err) {
                <p role="alert" class="text-sm text-tone-danger">{{ err }}</p>
              }
              @if (facade.attempt(); as at) {
                <aula-feedback-panel [feedback]="at.feedback" [language]="a.language" />
                <button aulaButton type="button" size="lg" (click)="next()">
                  {{ facade.index() + 1 >= facade.total() ? tx.finish : tx.next }} →
                </button>
              } @else {
                <button
                  aulaButton
                  type="button"
                  size="lg"
                  [loading]="facade.checking()"
                  [disabled]="!canCheck()"
                  (click)="facade.check(answer())"
                >
                  {{ facade.checking() ? tx.checking : tx.check }}
                </button>
              }
            </div>
          }
        </aula-card-page>
      }
    }
  `,
})
export default class PracticePlayerPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(PracticeFacade);
  readonly activityId = input<string>(); // Opcional: el router lo rellena (withComponentInputBinding); sin valor no se carga nada // /practica/:activityId
  protected readonly answer = signal<string[]>([]);
  // [canCheck]: hay algo respondido (mark_errors admite «no hay errores» = lista vacía)
  protected readonly canCheck = computed(
    () => this.facade.item()?.itemType === 'mark_errors' || this.answer().some((a) => a.trim()),
  );

  constructor() {
    effect(() => {
      const id = this.activityId();
      if (id) untracked(() => void this.facade.open(id));
    });
  }

  protected errorLabel(t: string): string {
    return (this.i18n.t().practice.errorTypes as Record<string, string>)[t] ?? t;
  }

  protected next(): void {
    this.answer.set([]);
    this.facade.next();
  }
}
