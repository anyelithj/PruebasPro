import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { LevelTintDirective } from '@shared/ui/atoms/level-tint/level-tint.directive';
import { TextInputComponent } from '@shared/ui/atoms/text-input/text-input.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { AssistantFacade } from '../../application/assistant.facade';
import {
  TUTOR_LANGUAGES,
  TUTOR_LEVELS,
  usagePercent,
  type ConversationSummary,
  type TutorLanguage,
  type TutorLevel,
} from '../../domain/models/assistant';
import { ConfirmDialogComponent } from '../components/confirm-dialog.component';
import { ConversationChatComponent } from '../components/conversation-chat.component';
import { ConversationListComponent } from '../components/conversation-list.component';
import { LanguageUsageMeterComponent } from '../components/language-usage-meter.component';
import { GuideChatComponent } from '@features/help/presentation/components/guide-chat.component';
import { GuideFacade } from '@features/help/application/guide.facade';
import { HELP_PROVIDERS } from '@features/help/help.routes';
// [AssistantPage · Presentación]: chat conversacional con el tutor RAG (respuesta en streaming) + [2026-10-28] «Mis conversaciones» (abrir, renombrar, eliminar), editar/eliminar mensajes y uso del idioma meta | [Patrón]: Container (inyecta la fachada, sin HTTP) | [Principio]: SRP + DIP | [Paradigma]: Declarativo + Reactivo
// [A11y]: etiqueta visible para el mensaje e idioma · Enter envía y Mayús+Enter salta de línea · avisos de IA y errores con roles adecuados · borrados con diálogo modal (sin window.confirm)
// [Responsive]: < lg → la lista va plegada encima del chat (<details>) · ≥ lg → columna lateral de 18 rem

// [Nombre legible por idioma]: `Intl.DisplayNames` (ECMA-402) → «inglés», «francés»… sin tabla propia
const languageName = (code: string, locale: string) =>
  new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;

// [PendingDelete]: qué espera confirmación en el diálogo | unión discriminada por `kind`
type PendingDelete = { kind: 'conversation'; conversation: ConversationSummary } | { kind: 'message'; id: string };

@Component({
  selector: 'aula-assistant-page',
  imports: [
    NgTemplateOutlet, // Una sola plantilla de la lista para móvil (<details>) y escritorio (columna) | [Principio]: DRY
    FormField,
    CardPageTemplate,
    ConversationChatComponent,
    ConversationListComponent,
    ConfirmDialogComponent,
    LanguageUsageMeterComponent,
    TextInputComponent,
    ButtonComponent,
    IconComponent,
    LevelTintDirective,
    GuideChatComponent,
  ],
  providers: HELP_PROVIDERS, // [2026-11-09]: Soporte y Guía también en /tutor (mismo chat que el asistente flotante)
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().assistant;
    @let h = i18n.t().help;
    <aula-card-page [heading]="section() === 'tutor' ? t.title : h.botTitles[section()]" [subtitle]="section() === 'tutor' ? t.subtitle : h.modes[section() === 'support' ? 'support' : 'guide'].hint">
      <!-- [2026-11-09]: Tutor · Soporte · Guía en la misma página (antes solo el tutor) -->
      <nav pageNav class="flex flex-wrap gap-2" [attr.aria-label]="h.modesLabel">
        @for (s of sections; track s) {
          <button type="button" class="btn btn-sm" [class]="section() === s ? 'btn-primary' : 'btn-outline'" [attr.aria-pressed]="section() === s" (click)="select(s)">
            <aula-icon [name]="sectionIcons[s]" /> {{ s === 'tutor' ? t.tutor : modeLabel(s) }}
          </button>
        }
      </nav>
      @if (section() !== 'tutor') {
        <aula-guide-chat class="h-[min(70dvh,40rem)]" maxHeight="none" />
      }
      <ng-container pageActions>
      @if (section() === 'tutor') {
        <label class="sr-only" for="tutor-language">{{ t.language }}</label>
        <select
          id="tutor-language"
          class="control"
          [value]="facade.language()"
          (change)="facade.language.set($any($event.target).value)"
        >
          @for (l of languages; track l) {
            <option [value]="l">{{ name(l) }}</option>
          }
        </select>
        <label class="sr-only" for="tutor-level">{{ t.level }}</label>
        <select
          id="tutor-level"
          class="control"
          [value]="facade.level()"
          (change)="facade.level.set($any($event.target).value)"
        >
          @for (l of levels; track l) {
            <option [value]="l">{{ t.level }}: {{ l }}</option>
          }
        </select>
        <!-- [2026-10-24]: tamaño md (2.5 rem) = misma altura que los <select class="control"> (min-h-10) -->
        <button aulaButton variant="outline" type="button" [disabled]="facade.streaming()" (click)="facade.reset()">
          <aula-icon name="plus" /> {{ t.newChat }}
        </button>
      }
      </ng-container>

      @if (section() === 'tutor') {
      <div class="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <!-- [Mis conversaciones · 2026-10-28]: plegable en móvil (<details> nativo: teclado y lector sin JS) · abierta en escritorio -->
        <aside class="min-w-0 lg:border-r lg:border-border lg:pr-4">
          <details class="group lg:hidden">
            <summary class="flex cursor-pointer list-none items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-semibold">
              {{ t.conversationsTitle }} ({{ facade.conversations().length }})
              <aula-icon name="chevron-down" [size]="16" class="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <div class="mt-2 max-h-72 overflow-y-auto">
              <ng-container *ngTemplateOutlet="list" />
            </div>
          </details>
          <div class="hidden max-h-[min(75dvh,44rem)] overflow-y-auto lg:block">
            <ng-container *ngTemplateOutlet="list" />
          </div>
        </aside>

        <!-- [2026-10-23]: franja y burbujas con el degradado MORADO de la marca (antes el color MCER pintaba todo de verde en A1);
             el color del nivel queda solo en su insignia (y el nivel siempre en texto) -->
        <div class="min-w-0 space-y-3">
          <div class="flex items-center gap-3 rounded-xl bg-gradient-brand px-4 py-3 text-white">
            <span
              [aulaLevel]="facade.level()"
              class="grid size-10 shrink-0 place-items-center rounded-full bg-(--lvl) text-sm font-extrabold ring-2 ring-white/70"
              >{{ facade.level() }}</span
            >
            <span class="min-w-0">
              <span class="flex items-center gap-1.5 text-sm font-bold"
                ><aula-icon name="sparkles" [size]="16" /> {{ t.title }}</span
              >
              <span class="block truncate text-xs opacity-85"
                >{{ name(facade.language()) }} · {{ t.level }} {{ facade.level() }}</span
              >
            </span>
          </div>

          <!-- [Política de idioma]: qué se espera del alumno en su nivel (misma meta que aplica el tutor en FastAPI) -->
          <aside class="rounded-xl border border-tone-brand-line bg-tone-brand-soft px-4 py-3 text-sm" [attr.aria-label]="t.policyTitle">
            <p class="flex items-center gap-1.5 font-bold text-tone-brand"><aula-icon name="languages" [size]="16" /> {{ t.policyTitle }}</p>
            <p class="mt-1 text-foreground">{{ policy() }}</p>
          </aside>

          <!-- [Uso del idioma · 2026-10-28]: «Uso del idioma: 45 % / meta 60 %» (no aplica si se estudia español) -->
          @if (facade.language() !== 'es') {
            <aula-language-usage-meter [usage]="facade.usage()" [goal]="facade.goal()" [languageName]="name(facade.language())" />
          }

          <aula-conversation-chat
            [turns]="facade.turns()"
            [streaming]="facade.streaming()"
            [busy]="facade.busy()"
            [label]="t.title"
            [youLabel]="t.you"
            [tutorLabel]="t.tutor"
            [emptyLabel]="t.empty"
            [greeting]="t.greeting"
            (edited)="facade.editMessage($event.id, $event.content)"
            (removeRequested)="pending.set({ kind: 'message', id: $event })"
          />

          <!-- [Sugerencias]: con la conversación vacía, ideas de un clic (chips = misma pill de la app) -->
          @if (!facade.turns().length) {
            <nav class="flex flex-wrap gap-1.5" [attr.aria-label]="t.suggestionsLabel">
              @for (s of t.suggestions; track s) {
                <button type="button" class="chip" (click)="ask(s)">{{ s }}</button>
              }
            </nav>
          }
          @if (facade.error(); as err) {
            <p role="alert" class="text-tone-danger">{{ err }}</p>
          }
          <form class="flex flex-col gap-2 sm:flex-row sm:items-end" (submit)="onSubmit($event)" novalidate>
            <div class="min-w-0 flex-1">
              <label class="sr-only" for="tutor-message">{{ t.placeholder }}</label>
              <aula-text-input
                [formField]="f.message"
                inputId="tutor-message"
                [multiline]="true"
                [rows]="2"
                [placeholder]="t.placeholder"
                (keydown.enter)="onEnter($any($event))"
              />
            </div>
            <button aulaButton type="submit" [loading]="facade.streaming()" [disabled]="facade.busy()">
              <aula-icon name="send" />
              {{ facade.streaming() ? t.sending : t.send }}
            </button>
          </form>
        </div>
      </div>
      }

      <ng-template #list>
        <aula-conversation-list
          [conversations]="facade.conversations()"
          [activeId]="facade.sessionId()"
          [loading]="facade.loadingList()"
          [busy]="facade.busy() || facade.streaming()"
          (opened)="facade.open($event)"
          (renamed)="facade.rename($event.id, $event.title)"
          (removeRequested)="pending.set({ kind: 'conversation', conversation: $event })"
        />
      </ng-template>

      <!-- [Confirmar borrado · 2026-10-28]: un solo diálogo para conversación y mensaje -->
      <aula-confirm-dialog
        [open]="pending() !== null"
        [title]="confirmTexts().title"
        [body]="confirmTexts().body"
        [confirmLabel]="t.delete"
        [cancelLabel]="t.cancel"
        [busy]="facade.busy()"
        (confirmed)="confirmDelete()"
        (closed)="pending.set(null)"
      />
    </aula-card-page>
  `,
})
export default class AssistantPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(AssistantFacade);
  protected readonly languages = TUTOR_LANGUAGES;
  protected readonly levels: readonly TutorLevel[] = TUTOR_LEVELS;
  protected readonly pending = signal<PendingDelete | null>(null);
  // [section · 2026-11-09]: Tutor · Soporte · Guía
  protected readonly sections = ['tutor', 'support', 'guide'] as const;
  protected readonly sectionIcons = { tutor: 'graduation-cap', support: 'wrench', guide: 'compass' } as const;
  protected readonly section = signal<(typeof this.sections)[number]>('tutor');
  private readonly guide = inject(GuideFacade);
  protected modeLabel(s: 'support' | 'guide'): string {
    return this.i18n.t().help.modes[s].label;
  }
  protected select(s: (typeof this.sections)[number]): void {
    this.section.set(s);
    if (s !== 'tutor') this.guide.setMode(s);
  }

  private readonly model = signal({ message: '' });
  protected readonly f = form(this.model, (p) => required(p.message));

  // [policy]: texto de la banda MCER del nivel elegido con el nombre del idioma y la META del nivel | `computed` (Signals)
  protected readonly policy = computed(() => {
    const band = this.facade.level().charAt(0) as 'A' | 'B' | 'C';
    return this.i18n.fmt(this.i18n.t().assistant.policy[band], { lang: this.name(this.facade.language()), goal: usagePercent(this.facade.goal()) });
  });

  // [confirmTexts]: título y cuerpo del diálogo según lo que se va a borrar
  protected readonly confirmTexts = computed(() => {
    const t = this.i18n.t().assistant;
    const p = this.pending();
    return p?.kind === 'conversation'
      ? { title: t.deleteConversationTitle, body: this.i18n.fmt(t.deleteConversationBody, { title: p.conversation.title }) }
      : { title: t.deleteMessageTitle, body: t.deleteMessageBody };
  });

  constructor() {
    void this.facade.loadConversations();
    // [unsent]: si el envío falló, el texto vuelve al editor (no se pierde lo escrito) | `effect` (Signals)
    effect(() => {
      const text = this.facade.unsent();
      if (text === null) return;
      this.model.set({ message: text });
      this.facade.unsent.set(null);
    });
  }

  protected ask(text: string): void {
    this.facade.send(text);
  }

  protected name(code: TutorLanguage): string {
    return languageName(code, this.i18n.locale());
  }

  // [confirmDelete]: borra lo pendiente y cierra el diálogo solo si salió bien (si falla, el toast lo explica y se puede reintentar)
  protected async confirmDelete(): Promise<void> {
    const p = this.pending();
    if (!p) return;
    const ok = p.kind === 'conversation' ? await this.facade.remove(p.conversation.id) : await this.facade.deleteMessage(p.id);
    if (ok) this.pending.set(null);
  }

  // [onEnter]: Enter envía; Mayús+Enter deja el salto de línea nativo
  protected onEnter(e: KeyboardEvent): void {
    if (e.shiftKey) return;
    e.preventDefault();
    this.send();
  }

  protected onSubmit(e: Event): void {
    e.preventDefault();
    this.send();
  }

  private send(): void {
    const text = this.model().message;
    if (!text.trim()) return;
    this.facade.send(text);
    this.model.set({ message: '' }); // Limpia el editor al instante (el turno ya está en la conversación)
  }
}
