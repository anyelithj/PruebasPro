import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '@core/i18n/i18n.service';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
import { GameAgentFacade } from '../../application/game-agent.facade';
import { GamesRepository } from '../../domain/games.repository.port';
import type { Scenario } from '../../domain/models/games';
import { ConversationPanelComponent } from '../components/conversation-panel.component';
import { GameShellComponent } from '../components/game-shell.component';
// [RolePlayPage · Presentación · Sprint 8.9]: /juegos/role-play/:scenarioId — conversación guiada en el rol del escenario con objetivos visibles (pendiente → cumplido) y vocabulario clave con sonido | [Patrón]: Container (smart) + State Machine (objetivos) + Composite (ConversationPanel) | [Principio]: SRP + DIP + DRY | [Paradigma]: Declarativo + Reactivo
// [Inicio]: el agente abre con la frase del escenario (`opening`) sin llamar a la red; cada respuesta del motor marca objetivos por palabras clave (determinista)

@Component({
  selector: 'aula-role-play-page',
  imports: [GameShellComponent, ConversationPanelComponent, PronunciationButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().games;
    @if (scenario(); as sc) {
      <aula-game-shell
        [type]="'role_play'"
        [lang]="sc.language"
        [lvl]="sc.level"
        [scenarioId]="sc.id"
        (started)="agent.open(sc.opening || '')"
      >
        <div gameIntro class="mb-4 rounded-xl bg-gradient-soft p-4">
          <p class="text-lg font-bold">{{ sc.emoji }} {{ sc.title }} · {{ sc.level }}</p>
          <p class="text-sm text-muted-foreground">
            {{ i18n.fmt(tx.agentRole, { role: sc.role }) }}
          </p>
        </div>
        <aula-conversation-panel [objectives]="sc.objectives" [voice]="true">
          <div panelExtra>
            <h3 class="mb-1 text-sm font-bold">{{ tx.keyVocabulary }}</h3>
            <ul class="flex flex-col gap-1">
              @for (w of sc.vocabulary; track w) {
                <li class="flex items-center justify-between gap-2 text-sm">
                  <span [attr.lang]="sc.language">{{ w }}</span>
                  <aula-pronunciation-button
                    [text]="w"
                    [language]="sc.language"
                    [label]="i18n.t().vocabulary.listen"
                  />
                </li>
              }
            </ul>
          </div>
        </aula-conversation-panel>
      </aula-game-shell>
    } @else if (error()) {
      <p role="alert" class="py-4 text-sm text-tone-danger">{{ error() }}</p>
    }
  `,
})
export default class RolePlayPage {
  protected readonly i18n = inject(I18nService);
  protected readonly agent = inject(GameAgentFacade);
  private readonly repo = inject(GamesRepository);
  readonly scenarioId = input<string>(); // Opcional: el router lo rellena (withComponentInputBinding); sin valor no se carga nada // /juegos/role-play/:scenarioId
  protected readonly scenario = signal<Scenario | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.scenarioId();
      if (id) untracked(() => void this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    try {
      this.scenario.set(await firstValueFrom(this.repo.scenario(id)));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
