import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ServerAudioService } from '@core/audio/server-audio.service';
// [PronunciationButtonComponent · Molécula · Sprint 8.3]: botón de sonido del idioma (inglés según UK/US) | [Patrón]: Atomic Design (molécula) + Facade (ServerAudioService) | [Principio]: SRP + DRY
// [A11y]: nombre accesible con la palabra («Escuchar: umbrella») · objetivo táctil 44 px · `aria-pressed` mientras suena
// [2026-10-19]: suena con el audio del SERVIDOR (guardado en la nube y en el navegador) y solo si falla con la voz del sistema → ya no desaparece en navegadores sin voz del idioma

@Component({
  selector: 'aula-pronunciation-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="audio.play(text(), language(), rate())"
      [attr.aria-label]="label() + ': ' + text()"
      [attr.aria-pressed]="audio.playing() === text()"
      [title]="label()"
      [class.animate-pulse]="audio.playing() === text()"
      class="relative grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card text-primary transition-colors after:absolute after:-inset-1 after:content-[''] hover:border-primary hover:bg-tone-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
    >
      <!-- Icono «volumen» (lucide) en línea: decorativo · [2026-10-20]: 32 px / icono 16 px (antes 44/20 px) -->
      <svg
        viewBox="0 0 24 24"
        class="size-4"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path
          d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5zM16 9a5 5 0 0 1 0 6M19.4 18.4a9 9 0 0 0 0-12.8"
        />
      </svg>
    </button>
  `,
})
export class PronunciationButtonComponent {
  protected readonly audio = inject(ServerAudioService);
  readonly text = input.required<string>(); // Lo que se pronuncia
  readonly language = input('en');
  readonly rate = input(0.9); // Velocidad (shadowing usa 0.8)
  readonly label = input('Escuchar');
}
