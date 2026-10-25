import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AgentGameComponent } from '../components/agent-game.component';
// [TwentyQuestionsPage · Presentación · Sprint 8.9]: Fluidez: 20 preguntas — el agente guarda la palabra secreta; preguntas de sí o no | [Patrón]: Container delgado sobre AgentGameComponent (Template Method visual) | [Principio]: DRY + SRP | [Paradigma]: Declarativo
// [Ruta]: /juegos/... con ?lang=&level=&d= desde el hub (withComponentInputBinding)

@Component({
  selector: 'aula-twenty-questions-page',
  imports: [AgentGameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aula-agent-game
    [type]="'twenty_questions'"
    [lang]="lang()"
    [level]="level()"
    [d]="d()"
  />`,
})
export default class TwentyQuestionsPage {
  readonly lang = input<string>(); // ?lang=
  readonly level = input<string>(); // ?level=
  readonly d = input<string>(); // ?d= (dificultad 1–3)
}
