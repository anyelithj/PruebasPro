import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ListeningGameComponent } from '../components/listening-game.component';
// [ListenReformulatePage · Presentación · Sprint 8.10]: Comprensión: escucha y reformula — decir la idea con otras palabras | [Patrón]: Container delgado sobre ListeningGameComponent (Strategy por modo) | [Principio]: DRY + SRP | [Paradigma]: Declarativo

@Component({
  selector: 'aula-listen-reformulate-page',
  imports: [ListeningGameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aula-listening-game
    [mode]="'listen_reformulate'"
    [lang]="lang()"
    [level]="level()"
    [d]="d()"
  />`,
})
export default class ListenReformulatePage {
  readonly lang = input<string>(); // ?lang=
  readonly level = input<string>(); // ?level=
  readonly d = input<string>(); // ?d=
}
