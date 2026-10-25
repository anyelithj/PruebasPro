import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AgentGameComponent } from '../components/agent-game.component';
// [ChainedStoryPage · Presentación · Sprint 8.9]: Fluidez: historia encadenada — una frase por turno con la palabra que pide el agente; 60 s por turno | [Patrón]: Container delgado sobre AgentGameComponent (Template Method visual) | [Principio]: DRY + SRP | [Paradigma]: Declarativo
// [Ruta]: /juegos/... con ?lang=&level=&d= desde el hub (withComponentInputBinding)

@Component({
  selector: 'aula-chained-story-page',
  imports: [AgentGameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aula-agent-game
    [type]="'chained_story'"
    [turnSeconds]="60"
    [lang]="lang()"
    [level]="level()"
    [d]="d()"
  />`,
})
export default class ChainedStoryPage {
  readonly lang = input<string>(); // ?lang=
  readonly level = input<string>(); // ?level=
  readonly d = input<string>(); // ?d= (dificultad 1–3)
}
