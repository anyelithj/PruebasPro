import { ActivitySectionsComponent, PillNavComponent } from '@shared/ui/molecules/pill-nav/pill-nav.component'; // [2026-10-23]: pills de secciones (y vistas)
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { DialoguesFacade } from '../../application/dialogues.facade';
import type { Dialogue } from '../../domain/models/dialogues';
import { FilterPanelComponent } from '@shared/ui/molecules/filter-panel/filter-panel.component'; // [2026-11-11]: MISMO panel de filtros que Gestión
import { LevelBadgeComponent } from '../components/level-badge.component';
// [DialogueLibraryPage · Presentación · Sprint 9.11 · RF-125/RF-127]: /dialogos/biblioteca — diálogos guionados con nivel confirmado, filtrables por idioma, nivel y tema; el docente ve los suyos y el ADMIN los pendientes de confirmar | [Patrón]: Container (smart) + Facade | [Principio]: SRP + verificación humana visible (badge estimado/confirmado) | [Paradigma]: Declarativo + Reactivo

@Component({
  selector: 'aula-dialogue-library-page',
  imports: [IconComponent, ActivitySectionsComponent, PillNavComponent, 

    NgTemplateOutlet,
    RouterLink,
    CardPageTemplate,
    SpinnerComponent,
    FilterPanelComponent,
    LevelBadgeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().dialogues;
    <!-- [2026-10-23 · 4.º pase]: mismo encabezado que Recursos → título «Actividades», la sección en el subtítulo y en la pill activa; sin caja (bare) -->
    <aula-card-page [heading]="i18n.t().common.activitySections.title" [subtitle]="tx.title + ' · ' + tx.librarySubtitle" [bare]="true">
      <aula-activity-sections pageNav />
      <!-- [2026-11-03]: sin «Subir diálogo»; filtros (idioma, nivel y tema) con el diseño común -->
      <!-- [2026-11-11]: MISMO panel de filtros que Gestión → Actividades (Buscar · Nivel · Tema · Filtrar · Limpiar + idiomas) -->
      <aula-filter-panel [(search)]="search" [(level)]="level" [(language)]="language" [languageAll]="false" (cleared)="topic.set('')">
        <label class="filter-field">
          {{ i18n.t().dialogues.form.topic }}
          <select class="control" [value]="topic()" (change)="topic.set($any($event.target).value)">
            <option value="">{{ tx.form.noTopic }}</option>
            @for (t of dialogues.topics.data() ?? []; track t.id) {
              <option [value]="t.id" [selected]="t.id === topic()">{{ t.emoji }} {{ t.title }}</option>
            }
          </select>
        </label>
      </aula-filter-panel>
      <!-- [2026-10-23]: los dos tipos de diálogo en UNA sección → pills (antes «Biblioteca» era otra página con otro «Volver») -->
      <aula-pill-nav
        class="mb-6"
        [exact]="true"
        [label]="tx.views"
        [items]="[{ label: tx.topics, link: '/dialogos', icon: 'message-circle' }, { label: tx.library, link: '/dialogos/biblioteca', icon: 'library' }]"
      />
      @switch (dialogues.library.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-tone-danger">{{ dialogues.library.error() }}</p>
        }
        @case ('empty') {
          <p
            class="rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground"
          >
            {{ tx.noDialogues }}
          </p>
        }
        @case ('success') {
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (d of libraryShown(); track d.id) {
              <li>
                <ng-container
                  *ngTemplateOutlet="card; context: { $implicit: d, link: ['/dialogos', d.id] }"
                />
              </li>
            }
          </ul>
        }
      }

      @if (staff() && dialogues.mine.status() === 'success') {
        <section class="mt-8" aria-labelledby="dialogues-mine">
          <h2 id="dialogues-mine" class="title-section mb-3">{{ tx.mine }}</h2>
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (d of dialogues.mine.data(); track d.id) {
              <li>
                <ng-container
                  *ngTemplateOutlet="
                    card;
                    context: { $implicit: d, link: ['/dialogos', d.id] }
                  "
                />
              </li>
            }
          </ul>
        </section>
      }
      @if (admin() && dialogues.pending.status() === 'success') {
        <section class="mt-8" aria-labelledby="dialogues-pending">
          <h2 id="dialogues-pending" class="title-section mb-3"><aula-icon name="shield-check" /> {{ tx.pending }}</h2>
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (d of dialogues.pending.data(); track d.id) {
              <li>
                <ng-container
                  *ngTemplateOutlet="
                    card;
                    context: { $implicit: d, link: ['/dialogos', d.id] }
                  "
                />
              </li>
            }
          </ul>
        </section>
      }

      <ng-template #card let-d let-link="link">
        <article class="surface flex h-full flex-col gap-2 p-4">
          <h3 class="title-card">
            <a class="text-foreground hover:underline" [routerLink]="link">{{ d.title }}</a>
          </h3>
          <p class="flex flex-wrap items-center gap-1.5 type-meta">
            <span class="badge bg-tone-brand-soft text-tone-brand">{{
              i18n.languageName(d.language)
            }}</span>
            <aula-level-badge [level]="d.level" [status]="d.levelStatus" [labels]="tx.levelBadge" />
          </p>
          <p class="type-meta text-muted-foreground">{{ speakers(d) }}</p>
          <a class="btn btn-outline btn-sm mt-auto self-start" [routerLink]="link"
            >{{ tx.open }} →</a
          >
        </article>
      </ng-template>
    </aula-card-page>
  `,
})
export default class DialogueLibraryPage {
  protected readonly i18n = inject(I18nService);
  protected readonly dialogues = inject(DialoguesFacade);
  private readonly session = inject(SessionService);
  protected readonly language = signal('en');
  protected readonly level = signal('');
  protected readonly topic = signal('');
  protected readonly search = signal(''); // [2026-11-11]: por título (en el navegador)
  protected readonly libraryShown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return (this.dialogues.library.data() ?? []).filter((d) => !q || d.title.toLowerCase().includes(q));
  });
  protected readonly staff = computed(() => this.session.hasRole('TEACHER', 'ADMIN'));
  protected readonly admin = computed(() => this.session.hasRole('ADMIN'));

  constructor() {
    effect(
      () =>
        void this.dialogues.loadLibrary({
          language: this.language(),
          level: this.level() || undefined,
          topic: this.topic() || undefined,
        }),
    );
    effect(() => void this.dialogues.loadTopics({ language: this.language() }));
    effect(() => {
      if (this.staff()) void this.dialogues.loadMine();
      if (this.admin()) void this.dialogues.loadPending();
    });
  }

  protected speakers(d: Dialogue): string {
    return d.speakers.join(' · ');
  }
}
