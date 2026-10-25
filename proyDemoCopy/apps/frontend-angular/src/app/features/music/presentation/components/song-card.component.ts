import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LevelTintDirective } from '@shared/ui/atoms/level-tint/level-tint.directive';
// [SongCardComponent · Presentacional · Sprint 9.8 · RF-115/RF-128]: canción con idioma, nivel, estado (si no está publicada) y licencia visible | [Patrón]: Presentational Component | [Principio]: SRP + transparencia de derechos (la licencia siempre se ve) | [Paradigma]: Declarativo

@Component({
  selector: 'aula-song-card',
  imports: [RouterLink, LevelTintDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <article
      [aulaLevel]="level()"
      class="surface flex h-full flex-col gap-2 border-l-4 border-l-(--lvl) p-4"
    >
      <h3 class="text-base font-bold leading-tight">
        <a
          [routerLink]="link()"
          class="text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >{{ title() }}</a
        >
      </h3>
      @if (artist()) {
        <p class="text-sm text-muted-foreground">{{ artist() }}</p>
      }
      <p class="flex flex-wrap gap-1.5 text-xs">
        <span class="badge bg-tone-brand-soft text-tone-brand">{{ languageName() }}</span>
        <span class="badge bg-muted font-bold">{{ level() }}</span>
        @if (statusLabel()) {
          <span class="badge bg-tone-warning-soft text-tone-warning">{{ statusLabel() }}</span>
        }
      </p>
      <p class="mt-auto text-xs text-muted-foreground">© {{ licenseLabel() }}</p>
      <a [routerLink]="link()" class="btn btn-outline btn-sm self-start">{{ actionLabel() }} →</a>
    </article>
  `,
})
export class SongCardComponent {
  readonly title = input.required<string>();
  readonly artist = input('');
  readonly languageName = input.required<string>();
  readonly level = input.required<string>();
  readonly statusLabel = input(''); // Vacío = publicada (no se muestra)
  readonly licenseLabel = input.required<string>();
  readonly link = input.required<string | string[]>();
  readonly actionLabel = input('Escuchar');
}
