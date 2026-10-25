import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ListeningGameComponent } from '../components/listening-game.component';
// [QuickQaPage · Presentación · Sprint 8.10]: Comprensión: pregunta-respuesta rápida — dato clave con tiempo hasta responder | [Patrón]: Container delgado sobre ListeningGameComponent (Strategy por modo) | [Principio]: DRY + SRP | [Paradigma]: Declarativo

@Component({
  selector: 'aula-quick-qa-page',
  imports: [ListeningGameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aula-listening-game
    [mode]="'quick_qa'"
    [lang]="lang()"
    [level]="level()"
    [d]="d()"
  />`,
})
export default class QuickQaPage {
  readonly lang = input<string>(); // ?lang=
  readonly level = input<string>(); // ?level=
  readonly d = input<string>(); // ?d=
}
