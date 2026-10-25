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
import { RouterLink } from '@angular/router';
import { LANGUAGES } from '@aula/shared-schemas';
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { DialoguesFacade } from '../../application/dialogues.facade';
import { DialogueTopicPickerComponent } from '../components/dialogue-topic-picker.component';
import { TopicCardComponent } from '../components/topic-card.component';
// [DialogueHubPage · Presentación · Sprint 9.11 · RF-121/RF-122]: /dialogos — temas por idioma y nivel (presentarse, hobbies, rutinas, familia, animales, comida, viajes y cultura) para conversar con el avatar, acceso a la biblioteca e historial; el docente crea temas | [Patrón]: Container (smart) + Facade | [Principio]: SRP + mínimo privilegio | [Paradigma]: Declarativo + Reactivo
// [Responsive]: grilla 1 → 2 → 4 columnas

@Component({
  selector: 'aula-dialogue-hub-page',
  imports: [IconComponent, ActivitySectionsComponent, PillNavComponent, 
    RouterLink,
    CardPageTemplate,
    SpinnerComponent,
    DialogueTopicPickerComponent,
    TopicCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().dialogues;
    <!-- [2026-10-23 · 4.º pase]: mismo encabezado que Recursos → título «Actividades», la sección en el subtítulo y en la pill activa; sin caja (bare) -->
    <aula-card-page [heading]="i18n.t().common.activitySections.title" [subtitle]="tx.title + ' · ' + tx.subtitle" [bare]="true">
      <aula-activity-sections pageNav />
      <div pageActions class="flex flex-wrap gap-2">
        @if (staff()) {
          <a routerLink="/dialogos/subir" class="btn btn-primary btn-sm"><aula-icon name="upload" /> {{ tx.upload }}</a>
        }
      </div>
      <!-- [2026-10-23]: los dos tipos de diálogo en UNA sección → pills (antes «Biblioteca» era otra página con otro «Volver») -->
      <aula-pill-nav
        class="mb-6"
        [exact]="true"
        [label]="tx.views"
        [items]="[{ label: tx.topics, link: '/dialogos', icon: 'message-circle' }, { label: tx.library, link: '/dialogos/biblioteca', icon: 'library' }]"
      />
      <aula-dialogue-topic-picker
        class="mb-6"
        [(language)]="language"
        [(level)]="level"
        [languageLabel]="tx.language"
        [levelLabel]="tx.level"
        [names]="names()"
      />

      <section class="mb-8" aria-labelledby="dialogue-topics">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="dialogue-topics" class="text-lg font-extrabold tracking-tight">
            {{ tx.topics }}
          </h2>
          @if (staff()) {
            <button
              type="button"
              class="btn btn-outline btn-sm"
              [attr.aria-expanded]="creating()"
              (click)="creating.set(!creating())"
            >
              ＋ {{ tx.newTopic }}
            </button>
          }
        </div>
        @if (creating()) {
          <form
            class="mb-4 grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1fr_auto]"
            (submit)="$event.preventDefault(); createTopic()"
          >
            <label class="text-xs font-semibold text-muted-foreground">
              {{ tx.topicTitle }}
              <input
                class="control mt-1 w-full"
                maxlength="120"
                [value]="newTitle()"
                (input)="newTitle.set($any($event.target).value)"
              />
            </label>
            <label class="text-xs font-semibold text-muted-foreground">
              {{ tx.objectives }}
              <textarea
                class="control mt-1 w-full"
                rows="2"
                maxlength="800"
                [value]="newObjectives()"
                (input)="newObjectives.set($any($event.target).value)"
              ></textarea>
            </label>
            <div class="flex items-end gap-2">
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="newTitle().trim().length < 2 || dialogues.busy()"
              >
                {{ tx.create }}
              </button>
              <button type="button" class="btn btn-ghost" (click)="creating.set(false)">
                {{ tx.cancel }}
              </button>
            </div>
          </form>
        }
        @switch (dialogues.topics.status()) {
          @case ('loading') {
            <aula-spinner [label]="i18n.t().common.loading" />
          }
          @case ('error') {
            <p role="alert" class="text-sm text-tone-danger">{{ dialogues.topics.error() }}</p>
          }
          @case ('empty') {
            <p
              class="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground"
            >
              {{ tx.noTopics }}
            </p>
          }
          @case ('success') {
            <ul class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              @for (t of dialogues.topics.data(); track t.id) {
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
        <h2 id="dialogue-history" class="mb-3 text-lg font-extrabold tracking-tight">
          {{ tx.conversation.history }}
        </h2>
        @if (dialogues.history.status() === 'success') {
          <ul class="divide-y divide-border rounded-xl border border-border">
            @for (s of dialogues.history.data()!.slice(0, 8); track s.id) {
              <li class="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
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
          <p class="text-sm text-muted-foreground">{{ tx.conversation.noHistory }}</p>
        }
      </section>
      @if (dialogues.actionError()) {
        <p role="alert" class="mt-3 text-sm text-tone-danger">{{ dialogues.actionError() }}</p>
      }
    </aula-card-page>
  `,
})
export default class DialogueHubPage {
  protected readonly i18n = inject(I18nService);
  protected readonly dialogues = inject(DialoguesFacade);
  private readonly session = inject(SessionService);
  protected readonly language = signal('en');
  protected readonly level = signal('A2');
  protected readonly creating = signal(false);
  protected readonly newTitle = signal('');
  protected readonly newObjectives = signal('');
  protected readonly staff = computed(() => this.session.hasRole('TEACHER', 'ADMIN'));
  protected readonly names = computed(() =>
    Object.fromEntries(LANGUAGES.map((c) => [c, this.i18n.languageName(c)])),
  );

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

  protected async createTopic(): Promise<void> {
    const objectives = this.newObjectives()
      .split('\n')
      .map((o) => o.trim())
      .filter(Boolean)
      .slice(0, 8);
    if (
      await this.dialogues.createTopic({
        title: this.newTitle().trim(),
        objectives,
        language: this.language(),
      })
    ) {
      this.creating.set(false);
      this.newTitle.set('');
      this.newObjectives.set('');
    }
  }
}
