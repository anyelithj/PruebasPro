import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { ReadingSentence } from '../../domain/models/reading';
// [ReadingTranslationPaneComponent · Presentación · Lectura · 2026-10-28]: columna DERECHA del lector — la traducción al español frase a frase, con los mismos párrafos que el original
// y la frase que suena resaltada A LA VEZ que la original (misma `position`) | [Patrón]: Presentational Component (sin estado ni servicios) | [Principio]: SRP (el original lo pinta ReadingSentenceComponent) + DRY (mismos párrafos de `paragraphs()`) | [Paradigma]: Declarativo (signals)
// [A11y]: `lang="es"` en toda la columna · la frase activa usa `aria-current` + fondo y anillo (no solo color) · cada frase es un <button> nativo → pulsarla salta a esa frase en el lector
// [Sincronía]: `id="translation-{position}"` → la página la desplaza a la vista junto con `sentence-{position}` (scrollIntoBox)

@Component({
  selector: 'aula-reading-translation-pane',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div lang="es" class="space-y-4 text-base leading-relaxed">
      @for (para of paragraphs(); track $index) {
        <p [class]="verse() ? 'space-y-0' : ''">
          @for (s of para; track s.id) {
            <button
              type="button"
              [id]="'translation-' + s.position"
              [attr.aria-current]="active() === s.position ? 'true' : null"
              [class]="
                'rounded px-0.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none hover:bg-muted ' +
                (verse() ? 'block py-0.5 ' : 'inline ') +
                (active() === s.position ? 'bg-tone-brand-soft ring-1 ring-tone-brand-line text-foreground' : 'text-muted-foreground')
              "
              (click)="pick.emit(s.position)"
            >
              @if (s.translation) {
                {{ s.translation }}
              } @else {
                <span class="italic opacity-70">{{ pendingLabel() }}</span>
              }
            </button>
            @if (!verse()) {
              <span> </span>
            }
          }
        </p>
      }
    </div>
  `,
})
export class ReadingTranslationPaneComponent {
  readonly paragraphs = input.required<readonly (readonly ReadingSentence[])[]>(); // Mismos párrafos que el original (alineación por `position`)
  readonly active = input(-1); // `position` de la frase que suena (-1 = ninguna)
  readonly verse = input(false); // Poema: un verso por línea
  readonly pendingLabel = input(''); // Texto mientras la traducción de la frase se genera
  readonly pick = output<number>(); // Frase pulsada → la página salta a ella
}
