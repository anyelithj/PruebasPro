import { ActivitySectionsComponent } from '@shared/ui/molecules/pill-nav/pill-nav.component'; // [2026-10-23]: pills de secciones de Actividades
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { FilterPanelComponent } from '@shared/ui/molecules/filter-panel/filter-panel.component'; // [2026-11-14]: MISMO panel de filtros que Gestión
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { PolyglotFacade } from '../../application/polyglot.facade';
import { LanguagePickerComponent } from '../components/language-picker.component';
import { PolyglotCardsComponent } from '../components/polyglot-cards.component';
import { PolyglotTableComponent } from '../components/polyglot-table.component';
import { PolyglotTopicPickerComponent } from '../components/polyglot-topic-picker.component';
// [PolyglotPage · Presentación · Sprint 10.7 · RF-129 a RF-131, RF-138]: /poliglota — elegir tema e idiomas (y su orden), ver la tabla con imagen, término, IPA y sonido (tarjetas en móviles) y guardar la comparación | [Patrón]: Container (smart) + Facade | [Principio]: SRP + responsive + accesibilidad | [Paradigma]: Declarativo + Reactivo
// [Jerarquía visual]: 1) tema (panel de filtros) · 2) idiomas · 3) tabla, que ocupa el ancho
// [2026-11-14]: sin «Guardar comparación» ni «Mis comparaciones» (las comparaciones se crean en Gestión → Actividades → Poliglota) y sin
// interruptor UK/US en la tabla (el acento es la preferencia global del usuario) · el tema va en el MISMO panel (fondo, Filtrar y Limpiar) que Gestión

@Component({
  selector: 'aula-polyglot-page',
  imports: [ActivitySectionsComponent,
    CardPageTemplate,
    SpinnerComponent,
    FilterPanelComponent,
    PolyglotTopicPickerComponent,
    LanguagePickerComponent,
    PolyglotTableComponent,
    PolyglotCardsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().polyglot;
    <!-- [2026-10-23 · 4.º pase]: mismo encabezado que Recursos → título «Actividades», la sección en el subtítulo y en la pill activa; sin caja (bare) -->
    <aula-card-page [heading]="i18n.t().common.activitySections.title" [subtitle]="tx.title + ' · ' + tx.subtitle" [bare]="true">
      <aula-activity-sections pageNav />
      <!-- [2026-11-16]: sin «Administrar temas» (los temas se gestionan en Gestión → Actividades → Poliglota) -->

      @switch (p.topics.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-tone-danger">{{ p.topics.error() }}</p>
        }
        @case ('empty') {
          <p class="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">{{ tx.noTopics }}</p>
        }
        @case ('success') {
          <div class="space-y-6">
            <!-- [2026-11-16 · 3.er pase · «mucho espacio vacío»]: Nivel + selects de tema en UNA rejilla (auto-fit, columnas iguales que se estiran) que crece hasta Filtrar/Limpiar
                 → a cualquier ancho no quedan columnas vacías ni huecos; en pantallas estrechas los selects bajan y los botones quedan debajo -->
            <aula-filter-panel
              class="!mb-0"
              [showSearch]="false"
              [showLanguage]="false"
              [showLevel]="false"
              [(level)]="level"
              (apply)="p.loadTable()"
              (cleared)="clearFilters()"
            >
              <div class="grid min-w-0 flex-[999_1_30rem] gap-3 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
                <label class="filter-field">
                  {{ i18n.t().common.filters.level }}
                  <select class="control" [value]="level()" (change)="level.set($any($event.target).value)">
                    <option value="">{{ i18n.t().common.filters.all }}</option>
                    @for (l of levels; track l) {
                      <option [value]="l" [selected]="l === level()">{{ l }}</option>
                    }
                  </select>
                </label>
                <aula-polyglot-topic-picker
                  class="contents"
                  [inline]="true"
                  [topics]="visibleTopics()"
                  [selected]="p.topicId()"
                  [label]="tx.topic"
                  [labels]="{ choose: tx.chooseTopic, categories: tx.categories }"
                  (picked)="p.selectTopic($event)"
                />
              </div>
            </aula-filter-panel>

            <aula-language-picker
              [order]="p.languages()"
              [names]="names()"
              [legend]="tx.languages"
              [hint]="tx.languagesHint"
              [upLabel]="tx.up"
              [downLabel]="tx.down"
              [restoreLabel]="tx.restore"
              (toggled)="p.toggleLanguage($event)"
              (moved)="p.moveLanguage($event.lang, $event.delta)"
              (dropped)="p.dropLanguage($event.from, $event.to)"
              (restored)="p.restoreOrder()"
            />

            @switch (p.table.status()) {
              @case ('loading') {
                <aula-spinner [label]="i18n.t().common.loading" />
              }
              @case ('error') {
                <p role="alert" class="text-tone-danger">{{ p.table.error() }}</p>
              }
              @case ('empty') {
                <p class="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">{{ tx.empty }}</p>
              }
              @case ('success') {
                @if (p.table.data(); as t) {
                  <div class="hidden md:block">
                    <aula-polyglot-table
                      [rows]="t.rows"
                      [languages]="p.languages()"
                      [names]="names()"
                      [caption]="tx.tableCaption.replace('{topic}', t.topic.title)"
                      [imageLabel]="tx.image"
                      [listenLabel]="tx.listen"
                      [missingLabel]="tx.missing"
                      [unreviewedLabel]="tx.unreviewed"
                      [nativeLabel]="tx.nativeReview"
                    />
                  </div>
                  <div class="space-y-2 md:hidden">
                    <aula-polyglot-cards
                      [rows]="t.rows"
                      [languages]="p.languages()"
                      [names]="names()"
                      [label]="tx.cardsLabel.replace('{topic}', t.topic.title)"
                      [listenLabel]="tx.listen"
                      [missingLabel]="tx.missing"
                      [nativeLabel]="tx.nativeReview"
                    />
                  </div>
                }
              }
            }
          </div>
        }
      }
    </aula-card-page>
  `,
})
export default class PolyglotPage {
  protected readonly i18n = inject(I18nService);
  protected readonly p = inject(PolyglotFacade);
  private readonly route = inject(ActivatedRoute); // `ActivatedRoute` (Angular Router): lee ?tema= del enlace de Gestión → Actividades
  protected readonly names = computed(() =>
    Object.fromEntries(LANGUAGES.map((c) => [c, this.i18n.languageName(c)])),
  );

  // [Nivel · 2026-11-16]: `signal` (Angular) enlazado al select «Nivel» del panel de filtros ('' = todos)
  protected readonly level = signal('');
  protected readonly levels = CEFR_LEVELS; // [2026-11-16]: el select «Nivel» vive en la rejilla de la página (mismas columnas que los temas)
  // [visibleTopics]: `computed` → temas del nivel elegido; un tema sin niveles vale para todos | [Paradigma]: Reactivo + Funcional
  protected readonly visibleTopics = computed(() => {
    const lv = this.level();
    return (this.p.topics.data() ?? []).filter((t) => !lv || !t.levels.length || t.levels.includes(lv));
  });

  constructor() {
    void this.p.loadTopics(this.route.snapshot.queryParamMap.get('tema'));
    // `effect`: si el tema elegido no es del nivel nuevo, se pasa al primero que sí lo sea (la tabla nunca muestra un tema oculto)
    effect(() => {
      const list = this.visibleTopics();
      untracked(() => {
        if (list.length && !list.some((t) => t.id === this.p.topicId())) this.p.selectTopic(list[0].id);
      });
    });
  }

  // [clearFilters · «Limpiar»]: vuelve al primer tema y al orden de idiomas por defecto (lo que se ve al entrar)
  protected clearFilters(): void {
    const first = this.p.topics.data()?.[0];
    this.p.restoreOrder();
    if (first) this.p.selectTopic(first.id);
  }
}
