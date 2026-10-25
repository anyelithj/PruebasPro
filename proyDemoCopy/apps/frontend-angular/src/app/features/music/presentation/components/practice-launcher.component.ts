import { IconComponent, type IconName } from '@shared/ui/atoms/icon/icon.component';
import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { MusicFacade } from '../../application/music.facade';
import { PRACTICE_KINDS, type SongPracticeKind } from '../../domain/models/music';
// [PracticeLauncherComponent · Sprint 9.10 · RF-120]: /musica/cancion/:id/practica — elegir completar la letra, ordenar versos o marcar la palabra intrusa; genera (o reutiliza) la actividad y navega a /practica/:activityId | [Patrón]: Container ligero + Command (MusicFacade.practice) | [Principio]: bajo acoplamiento (no importa la feature Practice: solo navega a su ruta) | [Paradigma]: Declarativo + async/await

const ICON: Record<SongPracticeKind, IconName> = { // [2026-10-23]: iconos SVG (antes emojis)
  gap_fill: 'pen-line',
  order_lines: 'shuffle',
  mark_words: 'search',
};

@Component({
  selector: 'aula-practice-launcher',
  imports: [IconComponent, 
    BackLinkComponent,CardPageTemplate, SpinnerComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().music;
    @let song = music.song.data();
    <aula-card-page
      [heading]="i18n.fmt(tx.practice.title, { title: song?.title ?? '…' })"
      [subtitle]="tx.practice.subtitle"
    >
      <a aulaBackLink pageBack [routerLink]="['/musica/cancion', id()]"
        >{{ tx.backToSong }}</a
      >
      @switch (music.song.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ music.song.error() }}</p>
        }
        @case ('success') {
          @if (song?.status !== 'published') {
            <p class="rounded-xl bg-tone-warning-soft p-3 text-sm text-tone-warning">
              {{ tx.practice.onlyPublished }}
            </p>
          } @else {
            <ul class="grid gap-3 sm:grid-cols-3">
              @for (k of kinds; track k) {
                <li>
                  <button
                    type="button"
                    class="surface flex h-full w-full flex-col items-start gap-2 p-4 text-left hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    [disabled]="music.busy()"
                    (click)="start(k)"
                  >
                    <aula-icon [name]="icon[k]" [size]="22" />
                    <span class="font-bold">{{ tx.practice.kinds[k] }}</span>
                    <span class="text-sm text-muted-foreground">{{ tx.practice.hints[k] }}</span>
                    <span class="mt-auto text-sm font-semibold text-primary"
                      >{{ tx.practice.start }} →</span
                    >
                  </button>
                </li>
              }
            </ul>
          }
          @if (music.actionError()) {
            <p role="alert" class="mt-3 text-sm text-tone-danger">{{ music.actionError() }}</p>
          }
        }
      }
    </aula-card-page>
  `,
})
export class PracticeLauncherComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly music = inject(MusicFacade);
  private readonly router = inject(Router);
  readonly id = input<string>(); // /musica/cancion/:id/practica (withComponentInputBinding)
  protected readonly kinds = PRACTICE_KINDS;
  protected readonly icon = ICON;

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.music.loadSong(id);
    });
  }

  protected async start(kind: SongPracticeKind): Promise<void> {
    const activityId = await this.music.practice(this.id()!, kind);
    if (activityId) await this.router.navigate(['/practica', activityId]);
  }
}
