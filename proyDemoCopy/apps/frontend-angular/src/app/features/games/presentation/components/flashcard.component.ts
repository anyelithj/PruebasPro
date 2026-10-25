import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
// [FlashcardComponent · Presentacional · Sprint 8.8]: tarjeta que PIDE RECORDAR antes de mostrar la respuesta (recuperación activa) y luego califica el recuerdo 0–5 para SM-2 | [Patrón]: State Machine (oculta → mostrada → calificada) + Presentational Component | [Principio]: SRP (la repetición espaciada la calcula NestJS) | [Paradigma]: Declarativo + Reactivo
// [A11y]: la respuesta aparece en una región `aria-live`; los botones de calidad dicen el texto («Difícil»), no solo un número · [Movimiento]: giro 3D desactivado con «reducir movimiento»

export const QUALITY_VALUES = [0, 3, 4, 5] as const; // SM-2: 0 = olvido · 3 = con esfuerzo · 4 = bien · 5 = perfecto

@Component({
  selector: 'aula-flashcard',
  imports: [PronunciationButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <div class="space-y-4">
      <div
        class="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-gradient-soft p-6 text-center"
      >
        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {{ question() }}
        </p>
        <div class="flex items-center gap-2">
          <p class="text-3xl font-extrabold" [attr.lang]="language()">{{ front() }}</p>
          <aula-pronunciation-button [text]="front()" [language]="language()" />
        </div>
        <div aria-live="polite" class="min-h-12">
          @if (shown()) {
            <p
              class="text-xl font-semibold text-primary motion-safe:animate-in motion-safe:fade-in"
              lang="es"
            >
              {{ back() || '—' }}
            </p>
            @if (example()) {
              <p class="mt-1 text-sm italic text-muted-foreground" [attr.lang]="language()">
                «{{ example() }}»
              </p>
            }
          } @else {
            <p class="text-sm text-muted-foreground">{{ recallHint() }}</p>
          }
        </div>
      </div>
      @if (!shown()) {
        <button
          type="button"
          class="btn btn-primary btn-lg w-full sm:w-auto"
          (click)="shown.set(true)"
        >
          {{ revealLabel() }}
        </button>
      } @else {
        <fieldset class="space-y-2">
          <legend class="text-sm font-semibold">{{ howWellLabel() }}</legend>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            @for (q of qualities; track q; let i = $index) {
              <button
                type="button"
                class="btn"
                [class]="i === 0 ? 'btn-danger' : i === 3 ? 'btn-primary' : 'btn-outline'"
                [disabled]="busy()"
                (click)="graded.emit(q)"
              >
                {{ qualityLabels()[i] }}
              </button>
            }
          </div>
        </fieldset>
      }
    </div>
  `,
})
export class FlashcardComponent {
  readonly front = input.required<string>(); // Palabra en el idioma que se estudia
  readonly back = input(''); // Traducción
  readonly example = input<string | null>(null);
  readonly language = input('en');
  readonly cardKey = input(''); // Cambia con cada tarjeta → vuelve a ocultar la respuesta
  readonly busy = input(false);
  readonly question = input('¿Qué significa?');
  readonly recallHint = input('Primero intenta recordarla en voz alta.');
  readonly revealLabel = input('Mostrar respuesta');
  readonly howWellLabel = input('¿Qué tan bien la recordaste?');
  readonly qualityLabels = input<readonly string[]>(['No la recordé', 'Difícil', 'Bien', 'Fácil']);
  readonly graded = output<number>();
  protected readonly qualities = QUALITY_VALUES;
  protected readonly shown = signal(false);

  constructor() {
    effect(() => {
      this.cardKey();
      untracked(() => this.shown.set(false));
    });
  }
}
