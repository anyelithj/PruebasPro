import { ChangeDetectionStrategy, Component, input } from '@angular/core';
// [PromptCardComponent · Presentacional · Sprints 8.8–8.10]: estímulo del juego — imagen (emoji), palabra, frase o situación, con slot para audio | [Patrón]: Presentational Component + Content Projection | [Principio]: SRP + DRY | [Paradigma]: Declarativo
// [Identidad]: superficie con degradado suave de marca → el estímulo es el foco visual de la pantalla · [A11y]: emoji con `role="img"` y nombre; texto con su `lang`

@Component({
  selector: 'aula-prompt-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <div
      class="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-gradient-soft p-6 text-center"
    >
      @if (emoji()) {
        <span
          class="text-6xl leading-none"
          role="img"
          [attr.aria-label]="emojiLabel() || emoji()"
          >{{ emoji() }}</span
        >
      }
      @if (text()) {
        <p class="max-w-prose text-xl font-bold sm:text-2xl" [attr.lang]="language()">
          {{ text() }}
        </p>
      }
      @if (caption()) {
        <p class="text-sm text-muted-foreground">{{ caption() }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class PromptCardComponent {
  readonly emoji = input('');
  readonly emojiLabel = input('');
  readonly text = input('');
  readonly caption = input('');
  readonly language = input<string | null>(null);
}
