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
import { RouterLink } from '@angular/router';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
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
  imports: [IconComponent, ActivitySectionsComponent, 
    RouterLink,
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
      @if (staff()) {
        <a pageActions routerLink="/musica/subir" class="btn btn-primary btn-sm"
          ><aula-icon name="upload" /> {{ tx.upload }}</a
        >
      }

      <div class="mb-6 grid gap-3 rounded-xl bg-muted p-3 sm:grid-cols-2">
        <label class="text-xs font-semibold text-muted-foreground">
          {{ tx.language }}
          <select
            class="control mt-1 w-full bg-card"
            [value]="language()"
            (change)="language.set($any($event.target).value)"
          >
            @for (code of languages; track code) {
              <option [value]="code">{{ i18n.languageName(code) }}</option>
            }
          </select>
        </label>
        <label class="text-xs font-semibold text-muted-foreground">
          {{ tx.level }}
          <select
            class="control mt-1 w-full bg-card"
            [value]="level()"
            (change)="level.set($any($event.target).value)"
          >
            <option value="">{{ tx.anyLevel }}</option>
            @for (l of levels; track l) {
              <option [value]="l">{{ l }}</option>
            }
          </select>
        </label>
      </div>

      <section class="mb-8" aria-labelledby="music-collections">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="music-collections" class="text-lg font-extrabold tracking-tight">
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
            <p role="alert" class="text-sm text-tone-danger">{{ music.collections.error() }}</p>
          }
          @case ('empty') {
            <p
              class="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground"
            >
              {{ tx.noCollections }}
            </p>
          }
          @case ('success') {
            <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              @for (c of music.collections.data(); track c.id) {
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
        <h2 id="music-songs" class="mb-3 text-lg font-extrabold tracking-tight">
          <aula-icon name="music" /> {{ i18n.t().music.title }}
        </h2>
        @if (music.songs.status() === 'success') {
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (s of music.songs.data(); track s.id) {
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
            class="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground"
          >
            {{ tx.noSongs }}
          </p>
        }
      </section>

      @if (staff()) {
        <section class="mb-8" aria-labelledby="music-mine">
          <h2 id="music-mine" class="mb-3 text-lg font-extrabold tracking-tight">
            {{ tx.mySongs }}
          </h2>
          @if (music.mine.status() === 'success') {
            <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              @for (s of music.mine.data(); track s.id) {
                <li>
                  <aula-song-card
                    [title]="s.title"
                    [artist]="s.artist"
                    [languageName]="i18n.languageName(s.language)"
                    [level]="s.level"
                    [statusLabel]="s.status === 'published' ? '' : tx.status[s.status]"
                    [licenseLabel]="license(s)"
                    [link]="['/musica/subir', s.id]"
                    [actionLabel]="tx.edit"
                  />
                </li>
              }
            </ul>
          } @else if (music.mine.status() === 'empty') {
            <p class="text-sm text-muted-foreground">{{ tx.noMine }}</p>
          }
        </section>
      }

      @if (admin()) {
        <section aria-labelledby="music-review">
          <h2 id="music-review" class="mb-3 text-lg font-extrabold tracking-tight">
            <aula-icon name="shield-check" /> {{ tx.reviewQueue }}
          </h2>
          @if (music.reviewQueue.status() === 'success') {
            <ul class="divide-y divide-border rounded-xl border border-border">
              @for (s of music.reviewQueue.data(); track s.id) {
                <li class="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <a
                    class="font-semibold text-primary hover:underline"
                    [routerLink]="['/musica/subir', s.id]"
                    >{{ s.title }}</a
                  >
                  <span class="text-xs text-muted-foreground"
                    >{{ i18n.languageName(s.language) }} · {{ s.level }} · © {{ license(s) }}</span
                  >
                  <span class="ml-auto flex flex-wrap items-center gap-2">
                    <input
                      class="control h-9 w-56 text-xs"
                      [attr.aria-label]="tx.rejectReason"
                      [placeholder]="tx.rejectReason"
                      (input)="setReason(s.id, $any($event.target).value)"
                    />
                    <button
                      type="button"
                      class="btn btn-outline btn-sm"
                      [disabled]="music.busy() || !reasons()[s.id]?.trim()"
                      (click)="music.review(s.id, 'rejected', reasons()[s.id])"
                    >
                      ✕ {{ tx.reject }}
                    </button>
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      [disabled]="music.busy()"
                      (click)="music.review(s.id, 'published')"
                    >
                      ✓ {{ tx.publish }}
                    </button>
                  </span>
                </li>
              }
            </ul>
          } @else if (music.reviewQueue.status() === 'empty') {
            <p class="text-sm text-muted-foreground">{{ tx.noReview }}</p>
          }
          @if (music.actionError()) {
            <p role="alert" class="mt-2 text-sm text-tone-danger">{{ music.actionError() }}</p>
          }
        </section>
      }
    </aula-card-page>
  `,
})
export default class MusicHubPage {
  protected readonly i18n = inject(I18nService);
  protected readonly music = inject(MusicFacade);
  private readonly session = inject(SessionService);
  protected readonly languages = LANGUAGES;
  protected readonly levels = CEFR_LEVELS;
  protected readonly language = signal<string>('en');
  protected readonly level = signal('');
  protected readonly creating = signal(false);
  protected readonly newTitle = signal('');
  protected readonly newTheme = signal('');
  protected readonly reasons = signal<Record<string, string>>({});
  protected readonly staff = computed(() => this.session.hasRole('TEACHER', 'ADMIN'));
  protected readonly admin = computed(() => this.session.hasRole('ADMIN'));

  constructor() {
    // [Filtros]: idioma o nivel nuevos → se recargan colecciones y canciones publicadas
    effect(() => {
      const f = { language: this.language(), level: this.level() || undefined };
      void this.music.loadCollections(f);
      void this.music.loadSongs(f);
    });
    effect(() => {
      if (this.staff()) void this.music.loadMine();
      if (this.admin()) void this.music.loadReviewQueue();
    });
  }

  protected setReason(id: string, value: string): void {
    this.reasons.update((r) => ({ ...r, [id]: value }));
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
      language: this.language(),
      level: this.level() || undefined,
    });
    if (ok) {
      this.creating.set(false);
      this.newTitle.set('');
      this.newTheme.set('');
    }
  }
}
