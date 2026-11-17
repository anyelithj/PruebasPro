import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
import { IpaTextElement } from './ipa-text.element';
// [SayComponent · Molécula · 2026-10-28]: una palabra o frase del idioma estudiado DENTRO de una actividad (práctica, juegos) → botón de sonido + IPA + traducción al español
// [Reutiliza]: <aula-pronunciation-button> (audio del servidor con respaldo de la voz del sistema) + <aula-ipa-text-element ipa-only> (IPA UK/US y traducción con IpaLookupCache: caché, cola y circuito)
// [Uso]: `<aula-say [text]="it.prompt" [language]="a.language" />` · la ruta debe registrar `...IPA_TEXT_PROVIDERS` (vocabulary/ipa-text.providers.ts)
// [Patrón]: Composite (dos piezas existentes) + Presentational Component | [Principio]: DRY + SRP (la consulta la hace el elemento; aquí solo se compone) | [Paradigma]: Declarativo + Reactivo (signals)
// [A11y]: el texto lleva `lang` del idioma; la traducción `lang="es"`; el botón dice qué pronuncia · [Responsive]: `flex-wrap` → en móvil el IPA baja de línea

// [spokenText]: lo que se pronuncia y se consulta — huecos «___» como pausa y saltos de línea como frases | Función pura (exportada para pruebas y para quien necesite el mismo texto)
export const spokenText = (text: string): string =>
  text
    .replace(/_{3,}/g, '…')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('. ');

@Component({
  selector: 'aula-say',
  imports: [PronunciationButtonComponent, IpaTextElement],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (spoken()) {
      <span class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        @if (withButton()) {
          <aula-pronunciation-button [text]="spoken()" [language]="language()" [label]="label()" />
        }
        @if (withText()) {
          <span class="font-semibold" [attr.lang]="language()">{{ text() }}</span>
        }
        <!-- ipa-only: el texto ya está a la vista → solo IPA (+ traducción calculada si el contenido no la trae) -->
        <aula-ipa-text-element
          class="min-w-0"
          [text]="spoken()"
          [language]="language()"
          ipaOnly="true"
          [withTranslation]="computeTranslation()"
        />
        @if (showTranslation() && foreign() && translation()) {
          <span class="text-muted-foreground" lang="es">— {{ translation() }}</span>
        }
      </span>
    }
  `,
})
export class SayComponent {
  readonly text = input.required<string>(); // Palabra o frase en el idioma estudiado
  readonly language = input('en'); // ISO 639-1
  readonly translation = input<string | null | undefined>(undefined); // Traducción ya guardada (gana a la calculada)
  readonly showTranslation = input(true); // false = la traducción es la respuesta del juego (no se adelanta)
  readonly withButton = input(true); // false = la pantalla ya tiene su reproductor
  readonly withText = input(false); // true = también escribe el texto (cuando la pantalla no lo muestra)
  readonly label = input('Escuchar');

  protected readonly spoken = computed(() => spokenText(this.text()));
  protected readonly foreign = computed(() => this.language() !== 'es'); // En español no hay traducción al español
  // `computed`: traducción calculada solo si se quiere mostrar, el idioma no es español y no viene guardada → `'true'|'false'` (el elemento recibe atributos como texto)
  protected readonly computeTranslation = computed(() =>
    this.showTranslation() && this.foreign() && !this.translation() ? 'true' : 'false',
  );
}
