import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { MusicFacade } from '../../application/music.facade';
import { SongPracticeComponent } from './practice-link.component';
// [PracticeLauncherComponent · Sprint 9.10 · RF-120]: /musica/cancion/:id/practica — elegir completar la letra, ordenar versos o marcar la palabra intrusa; genera (o reutiliza) la actividad y navega a /practica/:activityId | [Patrón]: Container ligero + Command (MusicFacade.practice) | [Principio]: bajo acoplamiento (no importa la feature Practice: solo navega a su ruta) | [Paradigma]: Declarativo + async/await
// [2026-11-10]: las tarjetas viven en <aula-song-practice> (también encima del reproductor)

@Component({
  selector: 'aula-practice-launcher',
  imports: [BackLinkComponent, CardPageTemplate, SpinnerComponent, RouterLink, SongPracticeComponent],
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
          <p role="alert" class="text-tone-danger">{{ music.song.error() }}</p>
        }
        @case ('success') {
          @if (song?.status !== 'published') {
            <p class="rounded-xl bg-tone-warning-soft p-3 text-tone-warning">
              {{ tx.practice.onlyPublished }}
            </p>
          } @else {
            <aula-song-practice [songId]="id()!" />
          }
        }
      }
    </aula-card-page>
  `,
})
export class PracticeLauncherComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly music = inject(MusicFacade);
  readonly id = input<string>(); // /musica/cancion/:id/practica (withComponentInputBinding)

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.music.loadSong(id);
    });
  }
}
