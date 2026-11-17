import { NgTemplateOutlet } from '@angular/common';
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
import { HttpClient } from '@angular/common/http';
import { z } from 'zod';
import { API_URL } from '@core/http/api-url.token';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { PracticeFacade } from '../../application/practice.facade';
import type { ItemType } from '../../domain/models/practice';
import { DragOrderComponent } from '../components/drag-order.component';
import { ErrorBadgeComponent } from '../components/error-badge.component';
import { FeedbackPanelComponent } from '../components/feedback-panel.component';
import { FillBlankComponent } from '../components/fill-blank.component';
import { MarkErrorsComponent } from '../components/mark-errors.component';
import { MatchPairsComponent } from '../components/match-pairs.component';
import { MultipleChoiceComponent } from '../components/multiple-choice.component';
import { ActivityContentsComponent } from '../components/activity-contents.component';
import { SayComponent } from '@features/vocabulary/presentation/components/say.component'; // [2026-10-28]: IPA + traducción + sonido del texto del ejercicio
// [PracticePlayerPage · Presentación · Sprint 8.14]: /practica/:activityId — resolver ítem a ítem (opción múltiple, huecos, emparejar, ordenar, marcar errores, respuesta abierta) con la corrección DEBAJO del ejercicio y resumen final | [Patrón]: Container (smart) + Strategy (componente por tipo de ítem) + State Machine (respondiendo → corregido → siguiente → resultado) | [Principio]: SRP + OCP (tipo nuevo = un @case) + DIP | [Paradigma]: Declarativo + Reactivo
// [A11y]: progreso en texto, el ejercicio se bloquea tras comprobar, el panel de corrección se anuncia (role="status") · [Responsive]: una columna, botones grandes

// [SAY_PROMPT · 2026-10-28]: tipos cuyo enunciado se pronuncia ANTES de responder · fuera: «ordenar» (el enunciado es la instrucción; la frase se forma con las fichas)
// y «marcar errores» (el texto trae errores a propósito → no se modela mal pronunciado ni traducido; se oye la versión correcta tras comprobar) | `ReadonlySet` (TS): búsqueda O(1) inmutable
const SAY_PROMPT: ReadonlySet<ItemType> = new Set<ItemType>(['multiple_choice', 'fill_blank', 'match_pairs', 'open_answer']);

const SongHeadSchema = z.object({ title: z.string(), artist: z.string().catch(''), titleIpa: z.string().catch(''), titleTranslation: z.string().catch('') });
type SongHead = z.infer<typeof SongHeadSchema>;

@Component({
  selector: 'aula-practice-player-page',
  imports: [IconComponent, NgTemplateOutlet, 
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
    SayComponent,
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
          <p role="alert" class="text-tone-danger">{{ facade.activity.error() }}</p>
        </aula-card-page>
      }
      @case ('success') {
        @let a = facade.activity.data()!;
        <!-- [2026-11-11 · Práctica de una canción]: misma cabecera que el reproductor (Título · Artista, /IPA/, traducción · idioma · nivel) y el ejercicio debajo -->
        @let sg = song();
        <aula-card-page
          [heading]="sg ? sg.title : a.title"
          [headingLang]="a.language"
          [headingAside]="sg?.artist ?? ''"
          [headingIpa]="sg?.titleIpa ?? ''"
          [headingTranslation]="sg?.titleTranslation ?? ''"
          [subtitle]="sg ? i18n.languageName(a.language) + ' · ' + a.level : a.level + ' · ' + tx.skills[a.skill] + ' · ' + i18n.languageName(a.language)"
        >
          <!-- [2026-11-09]: llegada desde una canción (?cancion=id) → volver/cancelar regresa a la canción -->
          <a aulaBackLink pageBack [routerLink]="backLink()">{{ backLabel() }}</a>
          @if (sg) {
            <h2 class="title-section mb-3">{{ exerciseOf(a.title, sg.title) }}</h2>
          }
          <!-- [2026-10-23]: material de la actividad (vocabulario, juego, canción…) antes de los ejercicios -->
          @if (a.contents.length) {
            <aula-activity-contents class="mb-4" [contents]="a.contents" [labels]="tx.contents" />
          }
          @if (facade.done()) {
            <!-- ───── Resultado ───── -->
            <div class="space-y-4 text-center" role="status">
              <aula-icon class="mx-auto text-tone-brand" [name]="facade.score() >= 70 ? 'trophy' : 'biceps-flexed'" [size]="48" />
              <h2 class="title-section">{{ tx.resultTitle }}</h2>
              <p class="type-lead">{{ i18n.fmt(tx.resultScore, { pct: facade.score() }) }}</p>
              <!-- [RF-113]: resumen de los errores más frecuentes de la sesión (tipo con icono + texto + veces) -->
              <section class="mx-auto max-w-md text-left" [attr.aria-label]="tx.frequentErrors">
                <h3 class="title-card mb-2">{{ tx.frequentErrors }}</h3>
                @for (e of facade.frequentErrors(); track e.type) {
                  <p
                    class="flex items-center justify-between gap-2 border-b border-border py-1"
                  >
                    <aula-error-badge [type]="e.type" [label]="errorLabel(e.type)" />
                    <span class="font-semibold tabular-nums">× {{ e.count }}</span>
                  </p>
                } @empty {
                  <p class="text-tone-brand">{{ tx.noErrors }}</p>
                }
              </section>
              <div class="flex flex-wrap justify-center gap-2">
                <button aulaButton type="button" (click)="facade.restart()">{{ tx.retry }}</button>
                <a aulaBackLink [routerLink]="backLink()">{{ backLabel() }}</a>
              </div>
            </div>
          } @else if (facade.item(); as it) {
            <!-- ───── Ejercicio ───── -->
            <div class="mb-4 flex items-center justify-between gap-2">
              <p class="font-semibold" aria-live="polite">
                {{ i18n.fmt(tx.itemOf, { n: facade.index() + 1, total: facade.total() }) }}
              </p>
              <span class="flex items-center gap-2">
                <span class="badge bg-tone-brand-soft text-tone-brand">{{
                  tx.types[it.itemType]
                }}</span>
                <!-- [2026-11-09]: salir de la actividad sin terminarla -->
                <a class="btn btn-ghost btn-sm" [routerLink]="backLink()">{{ i18n.t().common.cancel }}</a>
              </span>
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
              <!-- [Pronunciación · 2026-10-28 → 2026-11-02]: sonido + IPA + traducción del enunciado DEBAJO de la pregunta (antes iba encima) | ver SAY_PROMPT -->
              <ng-template #say>
                <!-- [2026-11-06]: sin caja propia → la pone quien lo envuelve (pregunta + IPA + traducción en el mismo contenedor gris) -->
                <aula-say
                  [text]="it.prompt"
                  [language]="a.language"
                  [label]="i18n.t().vocabulary.listen"
                />
              </ng-template>
              @switch (it.itemType) {
                @case ('multiple_choice') {
                  <aula-multiple-choice
                    [prompt]="it.prompt"
                    [options]="it.options"
                    [name]="'mc-' + it.id"
                    [language]="a.language"
                    [disabled]="locked"
                    (changed)="answer.set($event)"
                  ><ng-container [ngTemplateOutlet]="say" /></aula-multiple-choice>
                }
                @case ('fill_blank') {
                  <aula-fill-blank
                    [prompt]="it.prompt"
                    [language]="a.language"
                    [disabled]="locked"
                    [blankLabel]="tx.blank"
                    (changed)="answer.set($event)"
                  ><ng-container [ngTemplateOutlet]="say" /></aula-fill-blank>
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
                  <div class="rounded-xl border border-border bg-muted/40 px-4 py-3"><ng-container [ngTemplateOutlet]="say" /></div>
                }
                @case ('drag_order') {
                  <p class="type-lead font-semibold">{{ it.prompt }}</p>
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
                    <span class="mb-2 block space-y-1 rounded-xl border border-border bg-muted/40 px-4 py-3">
                      <span class="block text-lg font-semibold" [attr.lang]="a.language">{{ it.prompt }}</span>
                      @if (saysPrompt(it.itemType)) {
                        <ng-container [ngTemplateOutlet]="say" />
                      }
                    </span>
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
                <p role="alert" class="text-tone-danger">{{ err }}</p>
              }
              @if (facade.attempt(); as at) {
                <aula-feedback-panel [feedback]="at.feedback" [language]="a.language" />
                <!-- [2026-10-28]: la respuesta correcta también se oye (el panel solo la escribe si fallaste → si acertaste, la escribe esta línea), con su IPA y traducción -->
                @if (at.feedback.correct_answer) {
                  <aula-say
                    [text]="at.feedback.correct_answer"
                    [language]="a.language"
                    [withText]="at.feedback.correct"
                    [label]="i18n.t().vocabulary.listen"
                  />
                }
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
  readonly cancion = input<string>(); // ?cancion=<id> → práctica lanzada desde el reproductor de canciones
  private readonly songId = computed(() => (/^[0-9a-f-]{36}$/i.test(this.cancion() ?? '') ? this.cancion()! : null)); // Solo un UUID → sin redirección abierta
  protected readonly backLink = computed(() => (this.songId() ? ['/musica/cancion', this.songId()!] : ['/practica']));
  // [song · 2026-11-11]: datos de la canción para la cabecera (artista, IPA y traducción del título) | fallo → cabecera normal (Fail Soft)
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  protected readonly song = signal<SongHead | null>(null);
  private readonly loadSong = effect((onCleanup) => {
    const id = this.songId();
    this.song.set(null);
    if (!id) return;
    const sub = this.http.get<unknown>(`${this.api}/music/songs/${id}`).subscribe({ next: (r) => this.song.set(SongHeadSchema.safeParse(r).data ?? null), error: () => undefined });
    onCleanup(() => sub.unsubscribe());
  });
  // «Still Loving You · Completar la letra» → «Completar la letra»
  protected exerciseOf(title: string, song: string): string {
    return title.startsWith(`${song} · `) ? title.slice(song.length + 3) : title;
  }
  protected readonly backLabel = computed(() => (this.songId() ? this.i18n.t().music.backToSong : this.i18n.t().practice.backToList));
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

  protected saysPrompt(t: ItemType): boolean {
    return SAY_PROMPT.has(t);
  }

  protected errorLabel(t: string): string {
    return (this.i18n.t().practice.errorTypes as Record<string, string>)[t] ?? t;
  }

  protected next(): void {
    this.answer.set([]);
    this.facade.next();
  }
}
