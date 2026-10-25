import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AgentGameComponent } from '../components/agent-game.component';
// [TabooPage · Presentación · Sprint 8.9]: Fluidez: tabú — describe tu palabra HABLANDO (grabación → texto) o escribiendo, sin las prohibidas | [Patrón]: Container delgado sobre AgentGameComponent (Template Method visual) | [Principio]: DRY + SRP | [Paradigma]: Declarativo
// [Ruta]: /juegos/... con ?lang=&level=&d= desde el hub (withComponentInputBinding)

@Component({
  selector: 'aula-taboo-page',
  imports: [AgentGameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aula-agent-game
    [type]="'taboo'"
    [voice]="true"
    [lang]="lang()"
    [level]="level()"
    [d]="d()"
  />`,
})
export default class TabooPage {
  readonly lang = input<string>(); // ?lang=
  readonly level = input<string>(); // ?level=
  readonly d = input<string>(); // ?d= (dificultad 1–3)
}
