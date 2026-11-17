import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { AssistantFacade } from '../../application/assistant.facade';
import { TUTOR_LANGUAGES, TUTOR_LEVELS, type TutorLanguage, type TutorLevel } from '../../domain/models/assistant';
import { AssistantRepository } from '../../domain/assistant.repository.port';
import { AssistantHttpRepository } from '../../infrastructure/assistant.http-repository';
import { ConversationChatComponent } from './conversation-chat.component';
// [TutorQuickChatComponent · Presentación · 2026-10-30]: pestaña «Tutor» del chatbot flotante — misma conversación que /tutor en pequeño: idioma, nivel, chat, enviar y eliminar la conversación
// [Patrón]: Container (trae sus providers: se crea solo al abrir la pestaña) + Composition (ConversationChatComponent) | [Principio]: DRY (AssistantFacade) + SRP | [Paradigma]: Declarativo + Reactivo
// [A11y]: etiquetas sr-only en los selectores · eliminar pide un segundo clic («¿Eliminar?») antes de borrar, sin ventanas sobre el <dialog> del chatbot

@Component({
  selector: 'aula-tutor-quick-chat',
  imports: [ConversationChatComponent, IconComponent],
  providers: [{ provide: AssistantRepository, useClass: AssistantHttpRepository }, AssistantFacade],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col gap-2' },
  template: `
    @let t = i18n.t().assistant;
    <div class="flex flex-wrap items-center gap-2">
      <label class="sr-only" for="quick-language">{{ t.language }}</label>
      <select id="quick-language" class="control min-h-9 flex-1 py-1 text-sm" [value]="facade.language()" (change)="facade.language.set($any($event.target).value)">
        @for (l of languages; track l) {
          <option [value]="l">{{ i18n.languageName(l) }}</option>
        }
      </select>
      <label class="sr-only" for="quick-level">{{ t.level }}</label>
      <select id="quick-level" class="control min-h-9 w-20 py-1 text-sm" [value]="facade.level()" (change)="facade.level.set($any($event.target).value)">
        @for (l of levels; track l) {
          <option [value]="l">{{ l }}</option>
        }
      </select>
      @if (facade.turns().length) {
        <button type="button" class="btn btn-ghost btn-sm" [disabled]="facade.streaming()" (click)="newChat()"><aula-icon name="plus" /> {{ t.newChat }}</button>
        <button type="button" class="btn btn-ghost btn-sm text-tone-danger" [disabled]="facade.streaming() || facade.busy()" (click)="removeChat()">
          <aula-icon name="trash-2" /> {{ confirming() ? t.deleteChat + '?' : t.deleteChat }}
        </button>
      }
    </div>
    <aula-conversation-chat
      class="min-h-0 flex-1"
      [turns]="facade.turns()"
      [streaming]="facade.streaming()"
      [busy]="facade.busy()"
      [label]="t.title"
      [youLabel]="t.you"
      [tutorLabel]="t.tutor"
      [greeting]="t.greeting"
      [fill]="true"
      (edited)="facade.editMessage($event.id, $event.content)"
      (removeRequested)="facade.deleteMessage($event)"
    />
    @if (facade.error(); as err) {
      <p role="alert" class="type-meta text-tone-danger">{{ err }}</p>
    }
    <form class="flex gap-2" (submit)="$event.preventDefault(); send()">
      <label for="quick-message" class="sr-only">{{ t.placeholder }}</label>
      <input id="quick-message" class="control min-w-0 flex-1" maxlength="2000" autocomplete="off" [placeholder]="t.placeholder" [value]="draft()" (input)="draft.set($any($event.target).value)" />
      <button type="submit" class="btn btn-primary btn-sm" [disabled]="facade.streaming() || !draft().trim()"><aula-icon name="send" /> {{ t.send }}</button>
    </form>
  `,
})
export class TutorQuickChatComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(AssistantFacade);
  protected readonly languages: readonly TutorLanguage[] = TUTOR_LANGUAGES;
  protected readonly levels: readonly TutorLevel[] = TUTOR_LEVELS;
  protected readonly draft = signal('');
  protected readonly confirming = signal(false);

  protected send(): void {
    this.facade.send(this.draft().trim());
    this.draft.set('');
    this.confirming.set(false);
  }

  protected newChat(): void {
    this.facade.reset();
    this.confirming.set(false);
  }

  // [removeChat]: primer clic pide confirmar · segundo borra en el servidor (si ya se guardó) y deja el chat vacío
  protected async removeChat(): Promise<void> {
    if (!this.confirming()) return this.confirming.set(true);
    const id = this.facade.sessionId();
    if (id) await this.facade.remove(id);
    this.newChat();
  }
}
