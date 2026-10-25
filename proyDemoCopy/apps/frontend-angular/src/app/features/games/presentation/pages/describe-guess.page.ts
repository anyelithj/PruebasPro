import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AgentGameComponent } from '../components/agent-game.component';
// [DescribeGuessPage · Presentación · Sprint 8.9]: Fluidez: describe y adivina — el agente describe y el usuario adivina con pistas | [Patrón]: Container delgado sobre AgentGameComponent (Template Method visual) | [Principio]: DRY + SRP | [Paradigma]: Declarativo
// [Ruta]: /juegos/... con ?lang=&level=&d= desde el hub (withComponentInputBinding)

@Component({
  selector: 'aula-describe-guess-page',
  imports: [AgentGameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aula-agent-game
    [type]="'describe_guess'"
    [lang]="lang()"
    [level]="level()"
    [d]="d()"
  />`,
})
export default class DescribeGuessPage {
  readonly lang = input<string>(); // ?lang=
  readonly level = input<string>(); // ?level=
  readonly d = input<string>(); // ?d= (dificultad 1–3)
}
