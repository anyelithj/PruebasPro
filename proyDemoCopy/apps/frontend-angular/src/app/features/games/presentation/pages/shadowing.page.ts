import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ListeningGameComponent } from '../components/listening-game.component';
// [ShadowingPage · Presentación · Sprint 8.10]: Comprensión: shadowing — escuchar la frase (voz en-GB/en-US) y repetirla grabando; coincidencia por palabras | [Patrón]: Container delgado sobre ListeningGameComponent (Strategy por modo) | [Principio]: DRY + SRP | [Paradigma]: Declarativo

@Component({
  selector: 'aula-shadowing-page',
  imports: [ListeningGameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aula-listening-game
    [mode]="'shadowing'"
    [lang]="lang()"
    [level]="level()"
    [d]="d()"
  />`,
})
export default class ShadowingPage {
  readonly lang = input<string>(); // ?lang=
  readonly level = input<string>(); // ?level=
  readonly d = input<string>(); // ?d=
}
