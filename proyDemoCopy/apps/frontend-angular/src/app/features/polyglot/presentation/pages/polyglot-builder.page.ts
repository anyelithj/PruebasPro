import { ReturnLinkComponent, ReturnToService } from '@core/layout/return-to'; // [2026-10-23]: «Volver» y salida hacia Gestión → Actividades cuando se llega con ?volver=
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { LANGUAGES } from '@aula/shared-schemas';
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { AiDraftDialogComponent } from '@shared/ui/organisms/ai-draft-dialog/ai-draft-dialog.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { PolyglotFacade } from '../../application/polyglot.facade';
import { DEFAULT_ORDER } from '../../domain/language-order';
import { TopicInputSchema, type Term, type TableRow, TOPIC_CATEGORIES, type TopicCategory } from '../../domain/models/polyglot';
import { PolyglotCellComponent } from '../components/polyglot-cell.component';
import { PolyglotConceptFormComponent } from '../components/polyglot-concept-form.component';
import { PolyglotTopicPickerComponent } from '../components/polyglot-topic-picker.component';
// [PolyglotBuilderPage · Presentación · Sprint 10.8 · RF-132]: /poliglota/administrar[/:id] (DOCENTE / ADMIN) — crear temas, publicar o volver a borrador, archivar, borrador con IA, obtener IPA, agregar conceptos y revisar términos e IPA (chino mandarín y ruso: revisión nativa) | [Patrón]: Container (smart) + Facade | [Principio]: SRP + verificación humana visible (estado y avisos en texto) | [Paradigma]: Declarativo + Reactivo

@Component({
  selector: 'aula-polyglot-builder-page',
  imports: [IconComponent, 
    ReturnLinkComponent,
    CardPageTemplate,
    SpinnerComponent,
    AiDraftDialogComponent,
    PolyglotTopicPickerComponent,
    PolyglotConceptFormComponent,
    PolyglotCellComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().polyglot;
    @let bx = tx.builder;
    <aula-card-page [heading]="bx.title" [subtitle]="bx.subtitle">
      <aula-return-link pageBack fallback="/poliglota" [label]="bx.back" />
      <div class="space-y-6">
        <form class="flex flex-wrap items-end gap-2 rounded-xl bg-muted p-3" (submit)="$event.preventDefault(); create()">
          <label class="w-20 text-xs font-semibold">
            {{ bx.emoji }}
            <input class="control mt-1 w-full text-center" maxlength="16" [value]="newEmoji()" (input)="newEmoji.set($any($event.target).value)" />
          </label>
          <label class="min-w-48 flex-1 text-xs font-semibold">
            {{ bx.topicTitle }} <span class="req" aria-hidden="true">*</span>
            <input class="control mt-1 w-full" required minlength="2" maxlength="120" [value]="newTitle()" (input)="newTitle.set($any($event.target).value)" />
          </label>
          <label class="w-48 text-xs font-semibold">
            {{ tx.category }}
            <select class="control mt-1 w-full" [value]="newCategory()" (change)="newCategory.set($any($event.target).value)">
              @for (c of categories; track c) {
                <option [value]="c">{{ tx.categories[c] }}</option>
              }
            </select>
          </label>
          <button type="submit" class="btn btn-primary" [disabled]="p.busy() || !canCreate()">＋ {{ bx.create }}</button>
        </form>

        @if (p.topics.loading()) {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        <aula-polyglot-topic-picker
          [topics]="p.topics.data() ?? []"
          [selected]="p.topicId()"
          [label]="tx.topic"
          [labels]="{ choose: tx.chooseTopic, categories: tx.categories }"
          [showStatus]="true"
          [draftLabel]="bx.status.draft"
          (picked)="open($event)"
        />

        @if (current(); as t) {
          <section class="space-y-4" aria-labelledby="pb-topic">
            <header class="flex flex-wrap items-center gap-2">
              <h2 id="pb-topic" class="text-xl font-extrabold">{{ t.emoji }} {{ t.title }}</h2>
              <span class="badge" [class]="t.status === 'published' ? 'bg-tone-brand-soft text-tone-brand' : 'bg-tone-warning-soft text-tone-warning'">{{
                bx.status[t.status]
              }}</span>
              <span class="ml-auto flex flex-wrap gap-2">
                @if (t.status === 'draft') {
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="p.busy()" (click)="p.setStatus(t.id, 'published')">✓ {{ bx.publish }}</button>
                } @else {
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="p.busy()" (click)="p.setStatus(t.id, 'draft')">{{ bx.unpublish }}</button>
                }
                <button type="button" class="btn btn-outline btn-sm" [disabled]="p.busy()" (click)="draftOpen.set(true)"><aula-icon name="sparkles" /> {{ bx.draft }}</button>
                <button type="button" class="btn btn-outline btn-sm" [disabled]="p.busy()" (click)="enrich()"><aula-icon name="languages" /> {{ bx.ipa }}</button>
                <button type="button" class="btn btn-ghost btn-sm text-tone-danger" [disabled]="p.busy()" (click)="archive(t.id)">{{ bx.archive }}</button>
              </span>
            </header>
            <p class="text-sm" aria-live="polite">
              @if (p.notice()) {
                <span class="text-tone-brand">✓ {{ p.notice() }}</span>
              }
              @if (p.actionError()) {
                <span role="alert" class="text-tone-danger">{{ p.actionError() }}</span>
              }
            </p>

            <details class="rounded-xl border border-border p-3" open>
              <summary class="cursor-pointer font-bold">＋ {{ bx.addConcept }}</summary>
              <div class="mt-3">
                <aula-polyglot-concept-form [names]="names()" [busy]="p.busy()" [labels]="conceptLabels()" (saved)="p.addConcept($event.input, $event.terms)" />
              </div>
            </details>

            <h3 class="text-sm font-bold">{{ bx.concepts }}</h3>
            @if (p.table.loading()) {
              <aula-spinner [label]="i18n.t().common.loading" />
            }
            <ul class="space-y-3">
              @for (r of p.table.data()?.rows ?? []; track r.concept.id) {
                <li class="surface p-3">
                  <div class="mb-2 flex items-center gap-2">
                    <span class="text-2xl" aria-hidden="true">{{ r.concept.emoji || '•' }}</span>
                    <span class="font-semibold" lang="es">{{ r.concept.gloss }}</span>
                    <button type="button" class="btn btn-ghost btn-sm ml-auto text-tone-danger" [disabled]="p.busy()" (click)="p.removeConcept(r.concept.id)">{{ bx.remove }}</button>
                  </div>
                  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    @for (l of langs; track l) {
                      <div class="rounded-lg bg-muted p-2">
                        <span class="block text-[11px] font-bold uppercase text-tone-brand">{{ names()[l] }}</span>
                        <aula-polyglot-cell [term]="r.terms[l] ?? null" [language]="l" [languageName]="names()[l] ?? l" [showReview]="true" [missingLabel]="tx.missing" [unreviewedLabel]="tx.unreviewed" [nativeLabel]="tx.nativeReview" />
                        @if (r.terms[l]; as term) {
                          <span class="mt-1 flex gap-1">
                            <input class="control h-9 min-w-0 flex-1 text-xs" [attr.aria-label]="'IPA ' + (names()[l] ?? l)" [value]="term.ipa" #ipaIn />
                            <button type="button" class="btn btn-outline btn-sm" [disabled]="p.busy() || (term.reviewed && !term.needsNativeReview)" (click)="review(term, ipaIn.value)">
                              {{ term.reviewed && !term.needsNativeReview ? '✓ ' + bx.reviewed : bx.review }}
                            </button>
                          </span>
                        } @else {
                          <span class="mt-1 flex gap-1">
                            <input class="control h-9 min-w-0 flex-1 text-xs" [attr.lang]="l" [attr.aria-label]="bx.terms + ': ' + (names()[l] ?? l)" #termIn />
                            <button type="button" class="btn btn-outline btn-sm" [disabled]="p.busy()" (click)="addTerm(r, l, termIn.value)">＋</button>
                          </span>
                        }
                      </div>
                    }
                  </div>
                </li>
              }
            </ul>
          </section>

          <aula-ai-draft-dialog [open]="draftOpen()" [title]="bx.draft" [hint]="bx.draftHint" (closed)="draftOpen.set(false)">
            <form class="flex flex-wrap items-end gap-3" (submit)="$event.preventDefault(); generate()">
              <label class="text-xs font-semibold">
                {{ bx.draftKind }}
                <select class="control mt-1" [value]="draftKind()" (change)="draftKind.set($any($event.target).value)">
                  <option value="word">{{ bx.kinds.word }}</option>
                  <option value="phrase">{{ bx.kinds.phrase }}</option>
                </select>
              </label>
              <label class="w-24 text-xs font-semibold">
                {{ bx.draftCount }}
                <input class="control mt-1 w-full" type="number" min="1" max="15" [value]="draftCount()" (input)="draftCount.set(+$any($event.target).value)" />
              </label>
              <button type="submit" class="btn btn-primary" [disabled]="p.busy()">
                @if (p.busy()) {
                  …
                } @else {
                  <aula-icon name="sparkles" /> {{ bx.generate }}
                }
              </button>
            </form>
          </aula-ai-draft-dialog>
        } @else {
          <p class="text-sm text-muted-foreground">{{ bx.select }}</p>
        }
      </div>
    </aula-card-page>
  `,
})
export default class PolyglotBuilderPage {
  protected readonly i18n = inject(I18nService);
  protected readonly p = inject(PolyglotFacade);
  private readonly router = inject(Router);
  private readonly returnTo = inject(ReturnToService); // [2026-10-23]: conserva ?volver= y regresa a Gestión
  readonly id = input<string>(); // `:id` de la ruta (withComponentInputBinding)
  protected readonly langs = DEFAULT_ORDER;
  protected readonly newTitle = signal('');
  protected readonly newEmoji = signal('🌍');
  protected readonly newCategory = signal<TopicCategory>('vocabulary');
  protected readonly categories = TOPIC_CATEGORIES;
  protected readonly draftOpen = signal(false);
  protected readonly draftKind = signal<'word' | 'phrase'>('word');
  protected readonly draftCount = signal(8);
  protected readonly names = computed(() => Object.fromEntries(LANGUAGES.map((c) => [c, this.i18n.languageName(c)])));
  protected readonly canCreate = computed(() => TopicInputSchema.safeParse({ title: this.newTitle() }).success);
  protected readonly current = computed(() => (this.p.topics.data() ?? []).find((t) => t.id === this.p.topicId()) ?? null);
  protected readonly conceptLabels = computed(() => {
    const b = this.i18n.t().polyglot.builder;
    return { emoji: b.emoji, gloss: b.gloss, kind: b.kind, kinds: b.kinds, imageUrl: b.imageUrl, imageLicense: b.imageLicense, terms: b.terms, addConcept: b.addConcept };
  });

  constructor() {
    void this.p.loadTopics(); // El personal recibe también los borradores (NestJS filtra por rol)
    // [Ruta]: /poliglota/administrar/:id abre ese tema con todos los idiomas
    effect(() => {
      const id = this.id();
      if (id) untracked(() => this.p.selectTopic(id));
    });
  }

  protected open(id: string): void {
    void this.returnTo.go(['/poliglota/administrar', id]);
    this.p.selectTopic(id);
  }

  protected async create(): Promise<void> {
    const t = await this.p.createTopic({ title: this.newTitle().trim(), emoji: this.newEmoji().trim() || undefined, category: this.newCategory() });
    if (t) {
      this.newTitle.set('');
      this.open(t.id);
    }
  }

  protected async archive(id: string): Promise<void> {
    if (await this.p.archiveTopic(id)) {
      this.p.topicId.set(null);
      void this.returnTo.leave('/poliglota/administrar');
    }
  }

  protected async generate(): Promise<void> {
    const n = await this.p.draft(this.draftKind(), this.draftCount());
    if (n !== null) {
      this.draftOpen.set(false);
      this.p.notice.set(this.i18n.t().polyglot.builder.generated.replace('{n}', String(n)));
    }
  }

  protected async enrich(): Promise<void> {
    const n = await this.p.enrich();
    if (n !== null) this.p.notice.set(this.i18n.t().polyglot.builder.ipaDone.replace('{n}', String(n)));
  }

  protected review(term: Term, ipa: string): void {
    void this.p.reviewTerm(term.id, ipa.trim() && ipa.trim() !== term.ipa ? { ipa: ipa.trim() } : {});
  }

  protected addTerm(r: TableRow, language: string, text: string): void {
    if (text.trim()) void this.p.saveTerms(r.concept.id, [{ language, text: text.trim() }]);
  }
}
