import { ReturnLinkComponent, ReturnToService } from '@core/layout/return-to'; // [2026-10-23]: «Volver» y salida hacia Gestión → Actividades cuando se llega con ?volver=
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, form, validateStandardSchema } from '@angular/forms/signals';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
import { pickLanguage, pickLevel } from '@core/layout/prefill'; // [2026-10-24]: ?idioma=&nivel= desde Gestión → Crear actividad
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { AiDraftDialogComponent } from '@shared/ui/organisms/ai-draft-dialog/ai-draft-dialog.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { ActivityBuilderFacade } from '../../application/activity-builder.facade';
import {
  ActivityInputSchema,
  ITEM_TYPES,
  SKILLS,
  isFull,
  type ActivityInput,
  type FullItem,
  type ItemInput,
  type ItemType,
} from '../../domain/models/practice';
import { PracticeItemFormComponent } from '../components/practice-item-form.component';
import { ActivityContentsComponent } from '../components/activity-contents.component';
import { TextImportComponent } from '@shared/ui/molecules/text-import/text-import.component';
// [ActivityBuilderPage · Presentación · Sprint 8.15]: /practica/constructor (mis actividades + nueva, a mano o con borrador de IA) y /practica/constructor/:id (editar datos, ítems, publicar y archivar) — solo DOCENTE/ADMIN | [Patrón]: Container (smart) + Master-Detail + Facade | [Principio]: SRP + DIP + DRY (un formulario de ítem para crear y editar) | [Paradigma]: Declarativo + Reactivo
// [Regla RF-114]: el borrador de IA entra como «borrador» marcado; publicar es una acción explícita del docente tras revisar · [A11y]: confirmaciones antes de archivar o quitar, estados con texto

@Component({
  selector: 'aula-activity-builder-page',
  imports: [IconComponent, 
    ReturnLinkComponent,
    RouterLink,
    FormField,
    CardPageTemplate,
    BadgeComponent,
    ButtonComponent,
    SpinnerComponent,
    AiDraftDialogComponent,
    PracticeItemFormComponent,
    ActivityContentsComponent,
    TextImportComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().practice;
    <aula-card-page [heading]="tx.builderTitle" [subtitle]="tx.builderSubtitle">
      <aula-return-link pageBack fallback="/practica" [label]="tx.backToList" />
      @if (b.error(); as err) {
        <p role="alert" class="mb-3 text-sm text-tone-danger">{{ err }}</p>
      }

      @if (!id()) {
        <!-- ───── Nueva actividad ───── -->
        <form
          class="mb-8 space-y-3 rounded-xl border border-border p-4"
          (submit)="$event.preventDefault(); create([], false)"
        >
          <h2 class="text-base font-bold">{{ tx.newActivity }}</h2>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label class="text-sm font-semibold sm:col-span-2"
              >{{ tx.activityTitle }}<input class="control mt-1 w-full" [formField]="f.title"
            /></label>
            <label class="text-sm font-semibold">
              {{ tx.language }}
              <select class="control mt-1 w-full" [formField]="f.language">
                @for (c of languages; track c) {
                  <option [value]="c">{{ i18n.languageName(c) }}</option>
                }
              </select>
            </label>
            <label class="text-sm font-semibold">
              {{ tx.level }}
              <select class="control mt-1 w-full" [formField]="f.level">
                @for (l of levels; track l) {
                  <option [value]="l">{{ l }}</option>
                }
              </select>
            </label>
            <label class="text-sm font-semibold">
              {{ tx.skill }}
              <select class="control mt-1 w-full" [formField]="f.skill">
                @for (s of skills; track s) {
                  <option [value]="s">{{ tx.skills[s] }}</option>
                }
              </select>
            </label>
            <label class="text-sm font-semibold sm:col-span-2 lg:col-span-3"
              >{{ tx.description }}<input class="control mt-1 w-full" [formField]="f.description"
            /></label>
          </div>
          <div class="flex flex-wrap gap-2">
            <button aulaButton type="submit" [loading]="b.busy()" [disabled]="f().invalid()">
              {{ tx.create }}
            </button>
            <!-- [2026-10-23]: la IA no exige título (se toma del tema o del material subido) -->
            <button aulaButton variant="outline" type="button" (click)="draftOpen.set(true)">
              <aula-icon name="sparkles" /> {{ tx.aiDraft }}
            </button>
          </div>
        </form>

        <h2 class="mb-2 text-base font-bold">{{ tx.myActivities }}</h2>
        @switch (b.mine.status()) {
          @case ('loading') {
            <aula-spinner [label]="i18n.t().common.loading" />
          }
          @case ('empty') {
            <p class="text-sm text-muted-foreground">{{ tx.noActivities }}</p>
          }
          @case ('error') {
            <p role="alert" class="text-sm text-tone-danger">{{ b.mine.error() }}</p>
          }
          @case ('success') {
            <ul class="divide-y divide-border rounded-xl border border-border">
              @for (a of b.mine.data()!; track a.id) {
                <li class="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span class="font-semibold"
                    >{{ a.title }}
                    <span class="font-normal text-muted-foreground"
                      >· {{ a.level }} · {{ i18n.languageName(a.language) }}</span
                    ></span
                  >
                  <span class="flex items-center gap-2">
                    <aula-badge [tone]="a.status === 'published' ? 'brand' : 'warning'">{{
                      tx.status[a.status]
                    }}</aula-badge>
                    @if (a.aiDraft && a.status === 'draft') {
                      <aula-badge tone="info">{{ tx.aiDraftBadge }}</aula-badge>
                    }
                    <a
                      aulaButton
                      variant="outline"
                      size="sm"
                      [routerLink]="['/practica/constructor', a.id]"
                      >{{ tx.edit }}</a
                    >
                  </span>
                </li>
              }
            </ul>
          }
        }
      } @else {
        <!-- ───── Editar actividad ───── -->
        @switch (b.current.status()) {
          @case ('loading') {
            <aula-spinner [label]="i18n.t().common.loading" />
          }
          @case ('error') {
            <p role="alert" class="text-sm text-tone-danger">{{ b.current.error() }}</p>
          }
          @case ('success') {
            @let a = b.current.data()!;
            <div
              class="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted p-3"
            >
              <div>
                <p class="text-lg font-bold">{{ a.title }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ a.level }} · {{ tx.skills[a.skill] }} · {{ i18n.languageName(a.language) }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <aula-badge [tone]="a.status === 'published' ? 'brand' : 'warning'">{{
                  tx.status[a.status]
                }}</aula-badge>
                @if (a.aiDraft && a.status === 'draft') {
                  <aula-badge tone="info">{{ tx.aiDraftBadge }}</aula-badge>
                }
                <button
                  aulaButton
                  size="sm"
                  type="button"
                  [loading]="b.busy()"
                  [disabled]="!a.items.length"
                  (click)="b.publish(a.id, a.status !== 'published')"
                >
                  {{ a.status === 'published' ? tx.unpublish : tx.publish }}
                </button>
                <a aulaButton variant="outline" size="sm" [routerLink]="['/practica', a.id]">{{
                  tx.start
                }}</a>
                <button
                  aulaButton
                  variant="ghost"
                  size="sm"
                  type="button"
                  class="text-tone-danger"
                  (click)="archive(a.id, a.title)"
                >
                  {{ tx.archive }}
                </button>
              </div>
            </div>
            <h2 class="mb-2 text-base font-bold">{{ tx.itemsTitle }} ({{ a.items.length }})</h2>
            <ol class="mb-6 space-y-2">
              @for (it of fullItems(); track it.id) {
                <li class="rounded-xl border border-border p-3">
                  @if (editing() === it.id) {
                    <aula-practice-item-form
                      [item]="it"
                      [uid]="it.id"
                      [busy]="b.busy()"
                      [submitLabel]="tx.save"
                      (saved)="saveItem(a.id, it.id, $event)"
                      (cancelled)="editing.set(null)"
                    />
                  } @else {
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div class="min-w-0">
                        <span class="badge mb-1 bg-tone-brand-soft text-tone-brand"
                          >{{ it.position + 1 }} · {{ tx.types[it.itemType] }} ·
                          {{ tx.skills[it.skill] }}</span
                        >
                        <p class="whitespace-pre-line text-sm" [attr.lang]="a.language">
                          {{ it.prompt }}
                        </p>
                      </div>
                      <div class="flex gap-1">
                        <button
                          aulaButton
                          variant="outline"
                          size="sm"
                          type="button"
                          (click)="editing.set(it.id)"
                        >
                          {{ tx.edit }}
                        </button>
                        <button
                          aulaButton
                          variant="ghost"
                          size="sm"
                          type="button"
                          class="text-tone-danger"
                          (click)="removeItem(a.id, it.id)"
                        >
                          {{ tx.removeItem }}
                        </button>
                      </div>
                    </div>
                  }
                </li>
              }
            </ol>
            <!-- [Contenidos vinculados · 2026-10-23]: vocabulario, juego, canción, diálogo… que forman la actividad -->
            <aula-activity-contents
              class="mb-6"
              [contents]="a.contents"
              [editable]="true"
              [busy]="b.busy()"
              [language]="a.language"
              [level]="a.level"
              [labels]="tx.contents"
              (save)="b.update(a.id, { contents: $event })"
            />
            <section class="rounded-xl border border-dashed border-primary/50 p-4">
              <h3 class="mb-3 text-sm font-bold">{{ tx.addItem }}</h3>
              <aula-practice-item-form
                uid="new"
                [busy]="b.busy()"
                [submitLabel]="tx.addItem"
                [cancellable]="false"
                (saved)="b.addItem(a.id, $event)"
              />
            </section>
          }
        }
      }
    </aula-card-page>

    <!-- ───── Borrador con IA ───── -->
    <aula-ai-draft-dialog
      [open]="draftOpen()"
      [title]="tx.aiDraftTitle"
      [hint]="tx.aiDraftHint"
      [closeLabel]="tx.cancel"
      (closed)="draftOpen.set(false)"
    >
      <!-- [Material · 2026-10-23]: los ejercicios pueden salir de un PDF, una imagen (OCR) o un enlace -->
      <aula-text-import
        class="mb-3"
        [language]="meta().language"
        [labels]="tx.source"
        (imported)="useSource($event.text, $event.title)"
      />
      @if (sourceText()) {
        <p class="mb-3 flex items-center justify-between gap-2 rounded-lg bg-tone-brand-soft px-3 py-2 text-xs text-tone-brand" role="status">
          ✓ {{ i18n.fmt(tx.source.loaded, { n: sourceText().length }) }}
          <button type="button" class="btn btn-ghost btn-sm" (click)="sourceText.set('')">✕</button>
        </p>
      }
      <form class="space-y-3" (submit)="$event.preventDefault(); generate()">
        <div class="grid gap-3 sm:grid-cols-[1fr_6rem]">
          <label class="text-sm font-semibold"
            >{{ tx.topic
            }}<input
              class="control mt-1 w-full"
              [value]="topic()"
              (input)="topic.set($any($event.target).value)"
          /></label>
          <label class="text-sm font-semibold"
            >{{ tx.count
            }}<input
              type="number"
              min="1"
              max="10"
              class="control mt-1 w-full"
              [value]="count()"
              (input)="count.set(+$any($event.target).value)"
          /></label>
        </div>
        <fieldset>
          <legend class="mb-1 text-sm font-semibold">{{ tx.itemType }}</legend>
          <div class="flex flex-wrap gap-2">
            @for (t of draftTypes; track t) {
              <button
                type="button"
                class="chip"
                [attr.aria-pressed]="types().includes(t)"
                (click)="toggleType(t)"
              >
                {{ tx.types[t] }}
              </button>
            }
          </div>
        </fieldset>
        <button
          aulaButton
          type="submit"
          [loading]="b.draft.loading()"
          [disabled]="(topic().trim().length < 2 && !sourceText()) || !types().length"
        >
          {{ tx.generate }}
        </button>
      </form>
      @switch (b.draft.status()) {
        @case ('loading') {
          <p role="status" class="text-sm text-muted-foreground">{{ tx.generating }}</p>
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ b.draft.error() }}</p>
        }
        @case ('success') {
          @let d = b.draft.data()!;
          <p class="text-xs text-muted-foreground">
            {{ i18n.t().common.aiReview }}
            @if (d.discarded) {
              · {{ i18n.fmt(tx.discarded, { n: d.discarded }) }}
            }
          </p>
          <ol class="max-h-64 space-y-2 overflow-y-auto">
            @for (it of d.items; track $index) {
              <li class="rounded-lg bg-muted p-2 text-sm">
                <b>{{ tx.types[it.itemType] }}:</b> {{ it.prompt }}
              </li>
            }
          </ol>
          <button
            aulaButton
            type="button"
            [loading]="b.busy()"
            [disabled]="!d.items.length"
            (click)="create(d.items, true)"
          >
            {{ i18n.fmt(tx.useDraft, { n: d.items.length }) }}
          </button>
        }
      }
    </aula-ai-draft-dialog>
  `,
})
export default class ActivityBuilderPage {
  protected readonly i18n = inject(I18nService);
  protected readonly b = inject(ActivityBuilderFacade);
  private readonly router = inject(Router);
  private readonly returnTo = inject(ReturnToService); // [2026-10-23]: conserva ?volver= y regresa a Gestión
  readonly id = input<string>(); // /practica/constructor/:id
  readonly ia = input<string>(); // [2026-10-23]: ?ia=1 (desde Gestión → «Nueva con IA») abre el borrador de IA al entrar
  readonly idioma = input<string>(); // [2026-10-24]: ?idioma= (withComponentInputBinding)
  readonly nivel = input<string>(); // ?nivel=
  protected readonly languages = LANGUAGES;
  protected readonly levels = CEFR_LEVELS;
  protected readonly skills = SKILLS;
  protected readonly draftTypes = ITEM_TYPES.filter((t) => t !== 'match_pairs'); // El borrador de IA no genera emparejar (sin regla en el prompt)
  protected readonly meta = signal<ActivityInput>({
    title: '',
    description: '',
    language: 'en',
    level: 'A2',
    skill: 'grammar',
  });
  protected readonly f = form(this.meta, (p) => validateStandardSchema(p, ActivityInputSchema));
  protected readonly editing = signal<string | null>(null);
  protected readonly draftOpen = signal(false);
  protected readonly topic = signal('');
  protected readonly sourceText = signal(''); // Texto del material subido (PDF, imagen, enlace)
  protected readonly count = signal(5);
  protected readonly types = signal<ItemType[]>(['multiple_choice', 'fill_blank']);
  protected readonly fullItems = () =>
    (this.b.current.data()?.items ?? []).filter(isFull) as FullItem[];

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void (id ? this.b.open(id) : this.b.loadMine()));
    });
    effect(() => {
      if (this.ia() === '1' && !this.id()) untracked(() => this.draftOpen.set(true));
    });
    // [Prefill · 2026-10-24]: actividad NUEVA → idioma y nivel elegidos en Gestión | `update` (signals): copia inmutable
    effect(() => {
      const [language, level] = [pickLanguage(this.idioma()), pickLevel(this.nivel())];
      if (this.id() || (!language && !level)) return;
      untracked(() => this.meta.update((m) => ({ ...m, ...(language ? { language } : {}), ...(level ? { level } : {}) })));
    });
  }

  // [useSource]: material leído → base del borrador; su título sugiere el tema si aún no hay
  protected useSource(text: string, title: string): void {
    this.sourceText.set(text);
    if (!this.topic().trim() && title) this.topic.set(title.slice(0, 160));
  }

  protected toggleType(t: ItemType): void {
    this.types.update((list) => (list.includes(t) ? list.filter((x) => x !== t) : [...list, t]));
  }

  protected generate(): void {
    const m = this.meta();
    void this.b.requestDraft({
      language: m.language,
      level: m.level,
      skill: m.skill,
      topic: this.topic().trim() || this.i18n.t().practice.source.defaultTopic,
      itemTypes: this.types(),
      count: Math.min(Math.max(this.count() || 1, 1), 10),
      sourceText: this.sourceText() || undefined,
    });
  }

  // [create]: a mano (sin ítems) o con el borrador (aiDraft = true) → abre la edición para revisar
  protected async create(items: ItemInput[], aiDraft: boolean): Promise<void> {
    // [Título · 2026-10-23]: si se creó con IA sin título, se usa el tema del borrador
    const m = this.meta();
    const parsed = ActivityInputSchema.safeParse({ ...m, title: m.title.trim() || this.topic().trim() || this.i18n.t().practice.source.defaultTopic });
    if (!parsed.success) return;
    const created = await this.b.create(parsed.data, items, aiDraft);
    if (created) {
      this.draftOpen.set(false);
      void this.returnTo.go(['/practica/constructor', created.id]);
    }
  }

  protected async saveItem(activityId: string, itemId: string, item: ItemInput): Promise<void> {
    if (await this.b.updateItem(activityId, itemId, item)) this.editing.set(null);
  }

  protected removeItem(activityId: string, itemId: string): void {
    if (confirm(this.i18n.t().practice.confirmRemoveItem))
      void this.b.removeItem(activityId, itemId);
  }

  protected async archive(id: string, title: string): Promise<void> {
    if (!confirm(this.i18n.fmt(this.i18n.t().practice.confirmArchive, { title }))) return;
    if (await this.b.archive(id)) void this.returnTo.leave('/practica/constructor');
  }
}
