import { ActivitySectionsComponent, PillNavComponent } from '@shared/ui/molecules/pill-nav/pill-nav.component'; // [2026-10-23]: pills de secciones (y vistas)
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { DialoguesFacade } from '../../application/dialogues.facade';
import { FilterPanelComponent } from '@shared/ui/molecules/filter-panel/filter-panel.component'; // [2026-11-11]: MISMO panel de filtros que Gestión
import { TopicCardComponent } from '../components/topic-card.component';
// [DialogueHubPage · Presentación · Sprint 9.11 · RF-121/RF-122]: /dialogos — temas por idioma y nivel (presentarse, hobbies, rutinas, familia, animales, comida, viajes y cultura) para conversar con el avatar, acceso a la biblioteca e historial; el docente crea temas | [Patrón]: Container (smart) + Facade | [Principio]: SRP + mínimo privilegio | [Paradigma]: Declarativo + Reactivo
// [Responsive]: grilla 1 → 2 → 4 columnas

@Component({
  selector: 'aula-dialogue-hub-page',
  imports: [ActivitySectionsComponent, PillNavComponent, 
    RouterLink,
    CardPageTemplate,
    SpinnerComponent,
    FilterPanelComponent,
    TopicCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().dialogues;
    <!-- [2026-10-23 · 4.º pase]: mismo encabezado que Recursos → título «Actividades», la sección en el subtítulo y en la pill activa; sin caja (bare) -->
    <aula-card-page [heading]="i18n.t().common.activitySections.title" [subtitle]="tx.title + ' · ' + tx.subtitle" [bare]="true">
      <aula-activity-sections pageNav />
      <!-- [2026-11-03]: sin «Subir diálogo» (se sube desde Gestión → Actividades → Diálogos); en su lugar, los filtros con el diseño común -->
      <!-- [2026-11-11]: MISMO panel de filtros que Gestión → Actividades · idioma y nivel siempre elegidos (el avatar conversa en uno) -->
      <aula-filter-panel [(search)]="search" [(level)]="level" [(language)]="language" [levelAll]="false" [languageAll]="false" defaultLevel="A2" />
      <!-- [2026-10-23]: los dos tipos de diálogo en UNA sección → pills (antes «Biblioteca» era otra página con otro «Volver») -->
      <aula-pill-nav
        class="mb-6"
        [exact]="true"
        [label]="tx.views"
        [items]="[{ label: tx.topics, link: '/dialogos', icon: 'message-circle' }, { label: tx.library, link: '/dialogos/biblioteca', icon: 'library' }]"
      />

      <section class="mb-8" aria-labelledby="dialogue-topics">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="dialogue-topics" class="title-section">
            {{ tx.topics }}
          </h2>
          <!-- [2026-11-16]: sin «＋ Nuevo tema» → los temas se crean en Gestión → Actividades → Diálogos (Tipo «Tema de conversación») -->
        </div>
        @switch (dialogues.topics.status()) {
          @case ('loading') {
            <aula-spinner [label]="i18n.t().common.loading" />
          }
          @case ('error') {
            <p role="alert" class="text-tone-danger">{{ dialogues.topics.error() }}</p>
          }
          @case ('empty') {
            <p
              class="rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground"
            >
              {{ tx.noTopics }}
            </p>
          }
          @case ('success') {
            <ul class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              @for (t of topicsShown(); track t.id) {
                <li>
                  <aula-topic-card
                    [id]="t.id"
                    [title]="t.title"
                    [emoji]="t.emoji"
                    [levels]="t.levels"
                    [objectives]="t.objectives"
                    [action]="tx.talk"
                    [query]="{ lang: language(), level: level() }"
                  />
                </li>
              }
            </ul>
          }
        }
      </section>

      <section aria-labelledby="dialogue-history">
        <h2 id="dialogue-history" class="title-section mb-3">
          {{ tx.conversation.history }}
        </h2>
        @if (dialogues.history.status() === 'success') {
          <ul class="divide-y divide-border rounded-xl border border-border">
            @for (s of dialogues.history.data()!.slice(0, 8); track s.id) {
              <li class="flex flex-wrap items-center justify-between gap-2 p-3">
                <span class="font-semibold"
                  >{{ topicTitle(s.topicId) }} · {{ i18n.languageName(s.language) }} ·
                  {{ s.level }}</span
                >
                <span class="flex items-center gap-3">
                  <span class="text-xs text-muted-foreground">{{
                    i18n.fmt(tx.conversation.turns, { n: s.userTurns })
                  }}</span>
                  <a
                    class="font-semibold text-primary hover:underline"
                    [routerLink]="['/dialogos/sesion', s.id]"
                    >{{ tx.conversation.transcript }}</a
                  >
                </span>
              </li>
            }
          </ul>
        } @else if (dialogues.history.status() === 'empty') {
          <p class="text-muted-foreground">{{ tx.conversation.noHistory }}</p>
        }
      </section>
      @if (dialogues.actionError()) {
        <p role="alert" class="mt-3 text-tone-danger">{{ dialogues.actionError() }}</p>
      }
    </aula-card-page>
  `,
})
export default class DialogueHubPage {
  protected readonly i18n = inject(I18nService);
  protected readonly dialogues = inject(DialoguesFacade);
  protected readonly language = signal('en');
  protected readonly level = signal('A2');
  protected readonly search = signal(''); // [2026-11-11]: por título u objetivos (en el navegador)
  protected readonly topicsShown = computed(() => {
    const q = this.search().trim().toLowerCase();
    return (this.dialogues.topics.data() ?? []).filter((t) => !q || `${t.title} ${(t.objectives ?? []).join(' ')}`.toLowerCase().includes(q));
  });

  constructor() {
    effect(
      () => void this.dialogues.loadTopics({ language: this.language(), level: this.level() }),
    );
    void this.dialogues.loadHistory();
  }

  protected topicTitle(id: string): string {
    const t = this.dialogues.topics.data()?.find((x) => x.id === id);
    return t ? `${t.emoji} ${t.title}` : '💬';
  }
}
