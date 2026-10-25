import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
// [AccentSwitchComponent · Molécula · Sprint 8.3]: interruptor UK/US del inglés — cambia IPA y voz sin nueva consulta (los dos IPA llegan en la misma respuesta) | [Patrón]: Atomic Design (molécula) + Observer (servicio compartido) | [Principio]: SSOT (el acento vive en SpeechSynthesisService) + DRY (traductor, banco, poliglota y gramática)
// [A11y]: `role="switch"` + `aria-checked` (WAI-ARIA Switch Pattern) · el estado se lee también en texto («UK» / «US»), no solo por posición o color · compacto (28 px) con área táctil ampliada por pseudo-elemento

@Component({
  selector: 'aula-accent-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="speech.accent() === 'uk'"
      [attr.aria-label]="label()"
      (click)="speech.setAccent(speech.accent() === 'uk' ? 'us' : 'uk')"
      class="relative inline-flex h-7 items-center gap-0.5 rounded-full border border-border bg-muted p-0.5 text-[11px] font-bold leading-none after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <!-- [Segmentos]: el activo lleva el degradado de marca; el texto dice cuál está elegido -->
      <span
        class="rounded-full px-2 py-1 transition-colors"
        [class]="
          speech.accent() === 'uk' ? 'bg-gradient-brand text-white' : 'text-muted-foreground'
        "
        >🇬🇧 UK</span
      >
      <span
        class="rounded-full px-2 py-1 transition-colors"
        [class]="
          speech.accent() === 'us' ? 'bg-gradient-brand text-white' : 'text-muted-foreground'
        "
        >🇺🇸 US</span
      >
    </button>
  `,
})
export class AccentSwitchComponent {
  protected readonly speech = inject(SpeechSynthesisService);
  readonly label = input('Acento británico (UK)'); // Nombre accesible: «activado» = UK
}
