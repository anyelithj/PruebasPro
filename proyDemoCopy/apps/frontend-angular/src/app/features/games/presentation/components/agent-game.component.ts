import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { GameAgentFacade } from '../../application/game-agent.facade';
import { GamesFacade } from '../../application/games.facade';
import type { GameType } from '../../domain/models/game-type';
import { ConversationPanelComponent } from './conversation-panel.component';
import { GameShellComponent } from './game-shell.component';
import { PromptCardComponent } from './prompt-card.component';
// [AgentGameComponent · Presentación · Sprint 8.9]: plantilla de los juegos de fluidez contra el agente (tabú, palabra prohibida, 20 preguntas, describe y adivina, historia encadenada, debate) | [Patrón]: Template Method visual + Strategy por tipo (qué estímulo se muestra) | [Principio]: DRY (seis páginas delgadas reutilizan esta) + OCP | [Paradigma]: Declarativo + Reactivo
// [Estímulo]: tabú/palabra prohibida → tu palabra y las prohibidas · historia/debate → el tema · 20 preguntas/describe → nada (el secreto lo tiene el agente)

@Component({
  selector: 'aula-agent-game',
  imports: [IconComponent, GameShellComponent, ConversationPanelComponent, PromptCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    @let tx = i18n.t().games;
    @let c = games.session()?.content;
    <aula-game-shell
      [type]="type()"
      [lang]="lang()"
      [lvl]="level()"
      [diff]="d()"
      (started)="begin()"
    >
      <div class="space-y-4">
        @if (c?.target && c?.forbidden?.length) {
          <aula-prompt-card
            [text]="c!.target!"
            [language]="games.session()!.language"
            [caption]="tx.secretWord"
          >
            <p class="text-sm">
              <span class="font-semibold text-tone-danger"><aula-icon name="ban" /> {{ tx.forbiddenWords }}: </span>
              <span [attr.lang]="games.session()!.language">{{ c!.forbidden!.join(' · ') }}</span>
            </p>
          </aula-prompt-card>
        } @else if (c?.topic) {
          <aula-prompt-card
            [text]="c!.topic!"
            [language]="games.session()!.language"
            [caption]="tx.topic"
          />
        }
        <aula-conversation-panel [voice]="voice()" [turnSeconds]="turnSeconds()" />
      </div>
    </aula-game-shell>
  `,
})
export class AgentGameComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  private readonly agent = inject(GameAgentFacade);
  readonly type = input.required<GameType>();
  readonly voice = input(false);
  readonly turnSeconds = input(0);
  readonly lang = input<string>();
  readonly level = input<string>();
  readonly d = input<string>();
  protected readonly intro = computed(() => this.i18n.t().games.descriptions[this.type()]);

  // [begin]: el primer turno del agente son las instrucciones del juego (sin red)
  protected begin(): void {
    this.agent.open(this.intro());
  }
}
