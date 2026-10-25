import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ListeningGameComponent } from '../components/listening-game.component';
// [PartialDictationPage · Presentación · Sprint 8.10]: Comprensión: dictado parcial — escuchar y escribir la palabra que falta | [Patrón]: Container delgado sobre ListeningGameComponent (Strategy por modo) | [Principio]: DRY + SRP | [Paradigma]: Declarativo

@Component({
  selector: 'aula-partial-dictation-page',
  imports: [ListeningGameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aula-listening-game
    [mode]="'partial_dictation'"
    [lang]="lang()"
    [level]="level()"
    [d]="d()"
  />`,
})
export default class PartialDictationPage {
  readonly lang = input<string>(); // ?lang=
  readonly level = input<string>(); // ?level=
  readonly d = input<string>(); // ?d=
}
