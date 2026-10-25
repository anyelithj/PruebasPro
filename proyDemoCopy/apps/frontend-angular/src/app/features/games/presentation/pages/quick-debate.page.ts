import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AgentGameComponent } from '../components/agent-game.component';
// [QuickDebatePage · Presentación · Sprint 8.9]: Fluidez: debate rápido — argumentos con conectores; 90 s por turno | [Patrón]: Container delgado sobre AgentGameComponent (Template Method visual) | [Principio]: DRY + SRP | [Paradigma]: Declarativo
// [Ruta]: /juegos/... con ?lang=&level=&d= desde el hub (withComponentInputBinding)

@Component({
  selector: 'aula-quick-debate-page',
  imports: [AgentGameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aula-agent-game
    [type]="'debate'"
    [turnSeconds]="90"
    [lang]="lang()"
    [level]="level()"
    [d]="d()"
  />`,
})
export default class QuickDebatePage {
  readonly lang = input<string>(); // ?lang=
  readonly level = input<string>(); // ?level=
  readonly d = input<string>(); // ?d= (dificultad 1–3)
}
