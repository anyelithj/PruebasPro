import { ActivitySectionsComponent } from '@shared/ui/molecules/pill-nav/pill-nav.component'; // [2026-10-23]: pills de secciones de Actividades
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CEFR_LEVELS } from '@aula/shared-schemas';
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { LevelTintDirective } from '@shared/ui/atoms/level-tint/level-tint.directive';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { FilterPanelComponent } from '@shared/ui/molecules/filter-panel/filter-panel.component'; // [2026-11-11]: MISMO panel de filtros que Gestión
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { PracticeFacade } from '../../application/practice.facade';
import { SKILLS } from '../../domain/models/practice';
// [PracticeListPage · Presentación · Sprint 8.14]: /practica — actividades publicadas por idioma, nivel y habilidad | [Patrón]: Container (smart) + filtros en signals | [Principio]: SRP + DIP | [Paradigma]: Declarativo + Reactivo
// [Identidad]: cada tarjeta lleva el color de su nivel MCER (SSOT cefr-colors) · docentes ven el acceso al constructor · [Responsive]: grilla 1 → 2 → 3

@Component({
  selector: 'aula-practice-list-page',
  imports: [ActivitySectionsComponent, RouterLink, CardPageTemplate, SpinnerComponent, LevelTintDirective, FilterPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().practice;
    <!-- [2026-10-23 · 4.º pase]: mismo encabezado que Recursos → título «Actividades», la sección en el subtítulo y en la pill activa; sin caja (bare) -->
    <aula-card-page [heading]="i18n.t().common.activitySections.title" [subtitle]="tx.title + ' · ' + tx.subtitle" [bare]="true">
      <aula-activity-sections pageNav />
      <!-- [2026-11-11]: MISMO panel de filtros que Gestión → Actividades (Buscar · Nivel · Habilidad · Filtrar · Limpiar + idiomas) -->
      <aula-filter-panel
        [(search)]="search"
        [(level)]="level"
        [language]="language()"
        (languageChange)="language.set($event); load()"
        (apply)="load()"
        (cleared)="skill.set(''); load()"
      >
        <label class="filter-field">
          {{ tx.skill }}
          <select class="control" [value]="skill()" (change)="skill.set($any($event.target).value)">
            <option value="">{{ tx.all }}</option>
            @for (s of skills; track s) {
              <option [value]="s" [selected]="s === skill()">{{ tx.skills[s] }}</option>
            }
          </select>
        </label>
      </aula-filter-panel>

      @switch (facade.list.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-tone-danger">{{ facade.list.error() }}</p>
        }
        @case ('empty') {
          <p
            class="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground"
          >
            {{ tx.empty }}
          </p>
        }
        @case ('success') {
          @if (!shown().length) {
            <p class="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">{{ tx.empty }}</p>
          }
          <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (a of shown(); track a.id) {
              <!-- búsqueda por título/descripción: en el navegador (la lista ya está cargada) -->
              <li>
                <a
                  [routerLink]="['/practica', a.id]"
                  [aulaLevel]="a.level"
                  class="surface flex h-full flex-col gap-2 border-t-4 border-t-[var(--lvl)] p-4 text-foreground no-underline hover:-translate-y-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span class="flex flex-wrap gap-1">
                    <span class="badge bg-[var(--lvl)] text-white">{{ a.level }}</span>
                    <span class="badge bg-tone-brand-soft text-tone-brand">{{
                      tx.skills[a.skill]
                    }}</span>
                    <span class="badge bg-muted text-muted-foreground">{{
                      i18n.languageName(a.language)
                    }}</span>
                  </span>
                  <span class="text-base font-bold">{{ a.title }}</span>
                  @if (a.description) {
                    <span class="line-clamp-2 text-sm text-muted-foreground">{{
                      a.description
                    }}</span>
                  }
                  <span class="mt-auto text-sm font-semibold text-primary">{{ tx.start }} →</span>
                </a>
              </li>
            }
          </ul>
        }
      }
    </aula-card-page>
  `,
})
export default class PracticeListPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(PracticeFacade);
  private readonly session = inject(SessionService);
  protected readonly levels = CEFR_LEVELS;
  protected readonly skills = SKILLS;
  protected readonly language = signal('');
  protected readonly level = signal('');
  protected readonly skill = signal('');
  protected readonly search = signal('');
  protected readonly shown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return (this.facade.list.data() ?? []).filter((a) => !q || `${a.title} ${a.description ?? ''}`.toLowerCase().includes(q));
  });
  protected readonly isTeacher = () => this.session.hasRole('TEACHER', 'ADMIN');

  constructor() {
    void this.load();
  }

  protected load(): Promise<unknown> {
    return this.facade.loadList({
      language: this.language() || undefined,
      level: this.level() || undefined,
      skill: this.skill() || undefined,
    });
  }
}
