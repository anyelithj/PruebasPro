import { IconComponent, type IconName } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { MusicFacade } from '../../application/music.facade';
import { PRACTICE_KINDS, type SongPracticeKind } from '../../domain/models/music';
// [SongPracticeComponent · Presentacional · Sprint 9.10 · RF-120]: las 3 prácticas de una canción (completar, ordenar, palabra intrusa) → genera (o reutiliza) la actividad y navega a /practica/:activityId
// [2026-11-10]: antes un botón «Practicar con la canción» que abría otra página; ahora las tarjetas van directo encima del reproductor (y en /practica, DRY)
// [Patrón]: Presentational Component + Command (MusicFacade.practice) | [Principio]: bajo acoplamiento (solo navega a la feature Practice)

const ICON: Record<SongPracticeKind, IconName> = { gap_fill: 'pen-line', order_lines: 'shuffle', mark_words: 'search' };

@Component({
  selector: 'aula-song-practice',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().music.practice;
    <ul class="grid gap-3 sm:grid-cols-3">
      @for (k of kinds; track k) {
        <li>
          <button
            type="button"
            class="surface flex h-full w-full flex-col items-start gap-1 p-3 text-left hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            [disabled]="music.busy()"
            (click)="start(k)"
          >
            <span class="flex items-center gap-2 font-bold"><aula-icon [name]="icon[k]" [size]="20" /> {{ tx.kinds[k] }}</span>
            <span class="text-sm text-muted-foreground">{{ tx.hints[k] }}</span>
            <span class="mt-auto text-sm font-semibold text-primary">{{ tx.start }} →</span>
          </button>
        </li>
      }
    </ul>
    @if (music.actionError()) {
      <p role="alert" class="mt-2 text-tone-danger">{{ music.actionError() }}</p>
    }
  `,
})
export class SongPracticeComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly music = inject(MusicFacade);
  private readonly router = inject(Router);
  readonly songId = input.required<string>();
  protected readonly kinds = PRACTICE_KINDS;
  protected readonly icon = ICON;

  protected async start(kind: SongPracticeKind): Promise<void> {
    const activityId = await this.music.practice(this.songId(), kind);
    if (activityId) await this.router.navigate(['/practica', activityId], { queryParams: { cancion: this.songId() } }); // [2026-11-09]: la práctica sabe volver a la canción
  }
}
