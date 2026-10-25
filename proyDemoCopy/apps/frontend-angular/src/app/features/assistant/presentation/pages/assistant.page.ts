import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  type TutorLanguage,
  type TutorLevel,
} from '../../domain/models/assistant';
import { ConversationChatComponent } from '../components/conversation-chat.component';
// [AssistantPage · Presentación]: chat conversacional con el tutor RAG (respuesta en streaming) | [Patrón]: Container (inyecta la fachada, sin HTTP) | [Principio]: SRP + DIP | [Paradigma]: Declarativo + Reactivo
// [A11y]: etiqueta visible para el mensaje e idioma · Enter envía y Mayús+Enter salta de línea · avisos de IA y errores con roles adecuados

// [Nombre legible por idioma]: `Intl.DisplayNames` (ECMA-402) → «inglés», «francés»… sin tabla propia
const languageName = (code: string, locale: string) =>
  new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;

@Component({
  selector: 'aula-assistant-page',
  imports: [
    FormField,
    CardPageTemplate,
    ConversationChatComponent,
    TextInputComponent,
    ButtonComponent,
    IconComponent,
    LevelTintDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().assistant;
    <aula-card-page [heading]="t.title" [subtitle]="t.subtitle">
      <ng-container pageActions>
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
        <button aulaButton variant="outline" type="button" (click)="facade.reset()">
          {{ t.newChat }}
        </button>
      </ng-container>

      <!-- [2026-10-23]: franja y burbujas con el degradado MORADO de la marca (antes el color MCER pintaba todo de verde en A1);
           el color del nivel queda solo en su insignia (y el nivel siempre en texto) -->
      <div class="space-y-3">
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

        <!-- [Política de idioma]: qué se espera del alumno en su nivel (misma regla que sigue el tutor) -->
        <aside class="rounded-xl border border-tone-brand-line bg-tone-brand-soft px-4 py-3 text-sm" [attr.aria-label]="t.policyTitle">
          <p class="flex items-center gap-1.5 font-bold text-tone-brand"><aula-icon name="languages" [size]="16" /> {{ t.policyTitle }}</p>
          <p class="mt-1 text-foreground">{{ policy() }}</p>
        </aside>

        <aula-conversation-chat
          [turns]="facade.turns()"
          [streaming]="facade.streaming()"
          [label]="t.title"
          [youLabel]="t.you"
          [tutorLabel]="t.tutor"
          [emptyLabel]="t.empty"
        />
      </div>

      <!-- [Sugerencias]: con la conversación vacía, ideas de un clic (chips = misma pill de la app) -->
      @if (!facade.turns().length) {
        <nav class="mt-3 flex flex-wrap gap-1.5" [attr.aria-label]="t.suggestionsLabel">
          @for (s of t.suggestions; track s) {
            <button type="button" class="chip" (click)="ask(s)">{{ s }}</button>
          }
        </nav>
      }
      @if (facade.error(); as err) {
        <p role="alert" class="mt-3 text-sm text-tone-danger">{{ err }}</p>
      }
      <p class="mt-3 text-xs text-muted-foreground">{{ i18n.t().common.aiReview }}</p>

      <form
        class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
        (submit)="onSubmit($event)"
        novalidate
      >
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
        <button aulaButton type="submit" [loading]="facade.streaming()">
          <aula-icon name="send" />
          {{ facade.streaming() ? t.sending : t.send }}
        </button>
      </form>
    </aula-card-page>
  `,
})
export default class AssistantPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(AssistantFacade);
  protected readonly languages = TUTOR_LANGUAGES;
  protected readonly levels: readonly TutorLevel[] = TUTOR_LEVELS;

  private readonly model = signal({ message: '' });
  protected readonly f = form(this.model, (p) => required(p.message));

  // [policy]: texto de la banda MCER del nivel elegido con el nombre del idioma | `computed` (Signals)
  protected readonly policy = computed(() => {
    const band = this.facade.level().charAt(0) as 'A' | 'B' | 'C';
    return this.i18n.fmt(this.i18n.t().assistant.policy[band], { lang: this.name(this.facade.language()) });
  });

  protected ask(text: string): void {
    this.facade.send(text);
  }

  protected name(code: TutorLanguage): string {
    return languageName(code, this.i18n.locale());
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
