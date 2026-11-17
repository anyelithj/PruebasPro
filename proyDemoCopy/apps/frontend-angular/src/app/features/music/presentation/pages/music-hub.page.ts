import { ActivitySectionsComponent } from '@shared/ui/molecules/pill-nav/pill-nav.component'; // [2026-10-23]: pills de secciones de Actividades
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CEFR_LEVELS } from '@aula/shared-schemas';
import { FilterPanelComponent } from '@shared/ui/molecules/filter-panel/filter-panel.component'; // [2026-11-11]: panel común
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { MusicFacade } from '../../application/music.facade';
import type { Song } from '../../domain/models/music';
import { CollectionCardComponent } from '../components/collection-card.component';
import { SongCardComponent } from '../components/song-card.component';
// [MusicHubPage · Presentación · Sprint 9.8 · RF-115]: /musica — colecciones y canciones publicadas por idioma (siete) y nivel; el docente crea colecciones y ve sus canciones; el ADMIN revisa las pendientes | [Patrón]: Container (smart) + Facade | [Principio]: SRP + mínimo privilegio (la UI oculta; NestJS vuelve a comprobar el rol) | [Paradigma]: Declarativo + Reactivo
// [Responsive]: grilla 1 → 2 → 3 columnas · filtros en una fila desde sm

@Component({
  selector: 'aula-music-hub-page',
  imports: [IconComponent, ActivitySectionsComponent, FilterPanelComponent,
    CardPageTemplate,
    SpinnerComponent,
    CollectionCardComponent,
    SongCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().music;
    <!-- [2026-10-23 · 4.º pase]: mismo encabezado que Recursos → título «Actividades», la sección en el subtítulo y en la pill activa; sin caja (bare) -->
    <aula-card-page [heading]="i18n.t().common.activitySections.title" [subtitle]="tx.title + ' · ' + tx.subtitle" [bare]="true">
      <aula-activity-sections pageNav />
      <!-- [2026-11-11]: MISMO panel de filtros que Gestión → Actividades (Buscar · Nivel · Filtrar · Limpiar + idiomas) · idioma y nivel recargan al instante -->
      <aula-filter-panel [(search)]="search" [(level)]="level" [(language)]="language" />

      <section class="mb-8" aria-labelledby="music-collections">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="music-collections" class="title-section">
            {{ tx.collections }}
          </h2>
          @if (staff()) {
            <button
              type="button"
              class="btn btn-outline btn-sm"
              [attr.aria-expanded]="creating()"
              (click)="creating.set(!creating())"
            >
              ＋ {{ tx.newCollection }}
            </button>
          }
        </div>
        @if (creating()) {
          <form
            class="mb-4 grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1fr_auto]"
            (submit)="$event.preventDefault(); create()"
          >
            <label class="text-xs font-semibold text-muted-foreground">
              {{ tx.collectionTitle }}
              <input
                class="control mt-1 w-full"
                required
                minlength="2"
                maxlength="120"
                [value]="newTitle()"
                (input)="newTitle.set($any($event.target).value)"
              />
            </label>
            <label class="text-xs font-semibold text-muted-foreground">
              {{ tx.collectionTheme }}
              <input
                class="control mt-1 w-full"
                maxlength="60"
                [value]="newTheme()"
                (input)="newTheme.set($any($event.target).value)"
              />
            </label>
            <div class="flex items-end gap-2">
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="newTitle().trim().length < 2 || music.busy()"
              >
                {{ tx.create }}
              </button>
              <button type="button" class="btn btn-ghost" (click)="creating.set(false)">
                {{ tx.cancel }}
              </button>
            </div>
          </form>
        }
        @switch (music.collections.status()) {
          @case ('loading') {
            <aula-spinner [label]="i18n.t().common.loading" />
          }
          @case ('error') {
            <p role="alert" class="text-tone-danger">{{ music.collections.error() }}</p>
          }
          @case ('empty') {
            <p
              class="rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground"
            >
              {{ tx.noCollections }}
            </p>
          }
          @case ('success') {
            <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              @for (c of collectionsShown(); track c.id) {
                <li>
                  <aula-collection-card
                    [id]="c.id"
                    [title]="c.title"
                    [emoji]="c.emoji"
                    [languageName]="i18n.languageName(c.language)"
                    [level]="c.level"
                    [theme]="c.theme"
                    [description]="c.description"
                    [countLabel]="i18n.fmt(tx.songCount, { n: c.songCount ?? c.songIds.length })"
                  />
                </li>
              }
            </ul>
          }
        }
      </section>

      <section class="mb-8" aria-labelledby="music-songs">
        <h2 id="music-songs" class="title-section mb-3">
          <aula-icon name="music" /> {{ i18n.t().music.title }}
        </h2>
        @if (music.songs.status() === 'success') {
          <!-- [2026-11-06]: tarjetas de ancho mínimo 300 px (igual que Cursos) en vez de 3 columnas fijas -->
          <ul class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-4">
            @for (s of songsShown(); track s.id) {
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
          </ul>
        } @else if (music.songs.status() === 'empty') {
          <p
            class="rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground"
          >
            {{ tx.noSongs }}
          </p>
        }
      </section>

      <!-- [2026-10-26]: Actividades = solo escuchar y practicar · subir, editar, revisar y publicar → Gestión → Actividades (tabla) -->
    </aula-card-page>
  `,
})
export default class MusicHubPage {
  protected readonly i18n = inject(I18nService);
  protected readonly music = inject(MusicFacade);
  private readonly session = inject(SessionService);
  protected readonly levels = CEFR_LEVELS;
  protected readonly language = signal<string>(''); // '' = todos
  protected readonly level = signal('');
  protected readonly search = signal(''); // [2026-11-11]: por título, artista o tema (en el navegador)
  private readonly match = (text: string) => !this.search().trim() || text.toLowerCase().includes(this.search().trim().toLowerCase());
  protected readonly collectionsShown = computed(() => (this.music.collections.data() ?? []).filter((c) => this.match(`${c.title} ${c.theme ?? ''} ${c.description ?? ''}`)));
  protected readonly songsShown = computed(() => (this.music.songs.data() ?? []).filter((x) => this.match(`${x.title} ${x.artist ?? ''}`)));
  protected readonly creating = signal(false);
  protected readonly newTitle = signal('');
  protected readonly newTheme = signal('');
  protected readonly staff = computed(() => this.session.hasRole('TEACHER', 'ADMIN'));

  constructor() {
    // [Filtros]: idioma o nivel nuevos → se recargan colecciones y canciones publicadas
    effect(() => {
      const f = { language: this.language() || undefined, level: this.level() || undefined };
      void this.music.loadCollections(f);
      void this.music.loadSongs(f);
    });
  }

  protected license(s: Song): string {
    return this.i18n.fmt(this.i18n.t().media.license.shown, {
      type: this.i18n.t().media.license.types[s.license.type],
      holder: s.license.holder,
    });
  }

  protected async create(): Promise<void> {
    const ok = await this.music.createCollection({
      title: this.newTitle().trim(),
      theme: this.newTheme().trim() || undefined,
      language: this.language() || 'en', // Con «Todos» una colección nueva necesita un idioma: inglés por defecto (como antes)
      level: this.level() || undefined,
    });
    if (ok) {
      this.creating.set(false);
      this.newTitle.set('');
      this.newTheme.set('');
    }
  }
}
