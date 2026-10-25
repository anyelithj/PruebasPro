import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { MusicFacade } from '../../application/music.facade';
import type { Song } from '../../domain/models/music';
import { SongCardComponent } from '../components/song-card.component';
// [CollectionDetailPage · Presentación · Sprint 9.8 · RF-115]: /musica/coleccion/:id — canciones de la colección en orden; su autor o el ADMIN la archivan | [Patrón]: Container (smart) + Facade | [Principio]: SRP + mínimo privilegio | [Paradigma]: Declarativo + Reactivo

@Component({
  selector: 'aula-collection-detail-page',
  imports: [IconComponent, 
    BackLinkComponent,RouterLink, CardPageTemplate, SpinnerComponent, SongCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().music;
    @let c = music.collection.data();
    <aula-card-page
      [heading]="c?.title ?? tx.collections"
      [subtitle]="c?.description ?? ''"
    >
      <a aulaBackLink pageBack routerLink="/musica">{{ tx.back }}</a>
      <div pageActions class="flex flex-wrap gap-2">
        @if (canArchive()) {
          <button
            type="button"
            class="btn btn-outline btn-sm"
            [disabled]="music.busy()"
            (click)="archive()"
          >
            <aula-icon name="archive" /> {{ tx.archive }}
          </button>
        }
      </div>
      @switch (music.collection.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ music.collection.error() }}</p>
        }
        @case ('success') {
          @if (c?.songs?.length) {
            <ol class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              @for (s of c!.songs; track s.id) {
                <li>
                  <aula-song-card
                    [title]="s.title"
                    [artist]="s.artist"
                    [languageName]="i18n.languageName(s.language)"
                    [level]="s.level"
                    [licenseLabel]="license(s)"
                    [link]="['/musica/cancion', s.id]"
                    [actionLabel]="tx.listen"
                  />
                </li>
              }
            </ol>
          } @else {
            <p
              class="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground"
            >
              {{ tx.noSongs }}
            </p>
          }
        }
      }
    </aula-card-page>
  `,
})
export default class CollectionDetailPage {
  protected readonly i18n = inject(I18nService);
  protected readonly music = inject(MusicFacade);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  readonly id = input<string>(); // /musica/coleccion/:id (el router lo rellena con withComponentInputBinding)
  protected readonly canArchive = computed(() => {
    const c = this.music.collection.data();
    return (
      !!c &&
      (this.session.hasRole('ADMIN') ||
        (this.session.hasRole('TEACHER') && c.createdBy === this.session.user()?.id))
    );
  });

  constructor() {
    effect(() => {
      const id = this.id();
      if (id) void this.music.loadCollection(id);
    });
  }

  protected license(s: Song): string {
    const lic = this.i18n.t().media.license;
    return this.i18n.fmt(lic.shown, { type: lic.types[s.license.type], holder: s.license.holder });
  }

  protected async archive(): Promise<void> {
    if (await this.music.archiveCollection(this.id()!)) await this.router.navigateByUrl('/musica');
  }
}
