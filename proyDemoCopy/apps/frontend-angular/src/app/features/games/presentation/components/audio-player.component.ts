import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
// [AudioPlayerComponent · Presentacional · Sprints 8.8/8.10]: reproduce una palabra o frase con la voz del navegador (en-GB / en-US según el interruptor) a velocidad normal y lenta | [Patrón]: Presentational Component + Facade (SpeechSynthesisService) | [Principio]: SRP + DRY (bingo, shadowing, dictado, reformula, pregunta rápida) | [Paradigma]: Declarativo
// [Licencia]: no hay archivos de audio — la voz la sintetiza el sistema del usuario (sin derechos de terceros, Sprint 8.17)
// [A11y]: botones grandes con texto, estado «sonando» anunciado; si el navegador no tiene voz se avisa en texto

@Component({
  selector: 'aula-audio-player',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    @if (speech.supported) {
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="btn btn-primary btn-lg"
          (click)="speech.speak(text(), language(), 0.95)"
          [attr.aria-pressed]="speech.speaking()"
        >
          <aula-icon name="volume-2" /> {{ label() }}
        </button>
        <button
          type="button"
          class="btn btn-outline"
          (click)="speech.speak(text(), language(), 0.7)"
        >
          <aula-icon name="turtle" /> {{ slowLabel() }}
        </button>
      </div>
    } @else {
      <!-- [Sin voz]: aviso en texto SIN revelar la frase (es la respuesta en dictado, reformula y pregunta rápida) -->
      <p role="status" class="text-sm text-tone-warning"><aula-icon name="volume-x" /> {{ unsupportedLabel() }}</p>
    }
  `,
})
export class AudioPlayerComponent {
  protected readonly speech = inject(SpeechSynthesisService);
  readonly text = input.required<string>();
  readonly language = input('en');
  readonly label = input('Escuchar');
  readonly slowLabel = input('Más despacio');
  readonly unsupportedLabel = input('Tu navegador no puede reproducir la voz. Prueba con Chrome, Edge o Safari.');
}
