import { ReturnLinkComponent, ReturnToService } from '@core/layout/return-to'; // [2026-10-23]: «Volver» y salida hacia Gestión → Actividades cuando se llega con ?volver=
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas';
import { pickLanguage, pickLevel } from '@core/layout/prefill'; // [2026-10-24]: ?idioma=&nivel= desde Gestión → Crear actividad
import { I18nService } from '@core/i18n/i18n.service';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { GrammarFacade } from '../../application/grammar.facade';
import { SECTION_META, TopicInputSchema } from '../../domain/models/grammar';
import { GrammarCardComponent } from '../components/grammar-card.component';
import { GrammarExampleFormComponent } from '../components/grammar-example-form.component';
import { GrammarSectionFormComponent } from '../components/grammar-section-form.component';
// [GrammarEditorPage · Presentación · Sprint 10.12 · RF-135]: /gramatica/editor[/:id] (DOCENTE / ADMIN) — crear una ficha a mano o con borrador de IA, editar secciones y ejemplos (con vista previa de IPA y traducción), obtener IPA, publicar y archivar | [Patrón]: Container (smart) + Facade | [Principio]: SRP + verificación humana (el borrador nace sin publicar y lo dice) | [Paradigma]: Declarativo + Reactivo
// [Diseño]: dos zonas — edición a la izquierda y vista previa idéntica a la del estudiante a la derecha (escritorio); en móviles se apilan

@Component({
  selector: 'aula-grammar-editor-page',
  imports: [IconComponent, 
    ReturnLinkComponent, RouterLink, CardPageTemplate, SpinnerComponent, GrammarCardComponent, GrammarSectionFormComponent, GrammarExampleFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().grammar;
    @let ex = tx.editor;
    <aula-card-page [heading]="ex.title" [subtitle]="ex.subtitle">
      <aula-return-link pageBack fallback="/gramatica" [label]="tx.back" />
      <div class="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside class="space-y-4" aria-labelledby="ge-new">
          <form class="space-y-2 rounded-xl bg-muted p-3" (submit)="$event.preventDefault(); create(false)">
            <h2 id="ge-new" class="text-sm font-bold">＋ {{ ex.newTopic }}</h2>
            <label class="block text-xs font-semibold">
              {{ ex.topicTitle }}
              <input class="control mt-1 w-full" maxlength="120" [value]="title()" (input)="title.set($any($event.target).value)" />
            </label>
            <div class="grid grid-cols-2 gap-2">
              <label class="text-xs font-semibold">
                {{ tx.language }}
                <select class="control mt-1 w-full" [value]="language()" (change)="language.set($any($event.target).value)">
                  @for (l of langs; track l) {
                    <option [value]="l">{{ i18n.languageName(l) }}</option>
                  }
                </select>
              </label>
              <label class="text-xs font-semibold">
                {{ tx.level }}
                <select class="control mt-1 w-full" [value]="level()" (change)="level.set($any($event.target).value)">
                  @for (l of levels; track l) {
                    <option [value]="l">{{ l }}</option>
                  }
                </select>
              </label>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="submit" class="btn btn-outline btn-sm" [disabled]="g.busy() || !valid()">{{ ex.create }}</button>
              <button type="button" class="btn btn-primary btn-sm" [disabled]="g.busy() || !valid()" (click)="create(true)"><aula-icon name="sparkles" /> {{ ex.draft }}</button>
            </div>
            <p class="text-[11px] text-muted-foreground">{{ ex.draftHint }}</p>
            @if (generating()) {
              <p class="text-xs text-tone-brand" aria-live="polite">{{ ex.generating }}</p>
            }
          </form>

          <nav [attr.aria-label]="ex.mine">
            <h2 class="mb-2 text-sm font-bold">{{ ex.mine }}</h2>
            <ul class="space-y-1">
              @for (t of g.topics.data() ?? []; track t.id) {
                <li>
                  <a
                    [routerLink]="['/gramatica/editor', t.id]"
                    class="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm hover:bg-tone-brand-soft"
                    [class.bg-tone-brand-soft]="t.id === id()"
                    [attr.aria-current]="t.id === id() ? 'page' : null"
                  >
                    <span class="truncate font-semibold">{{ t.title }}</span>
                    <span class="badge shrink-0" [class]="t.status === 'published' ? 'bg-tone-brand-soft text-tone-brand' : 'bg-tone-warning-soft text-tone-warning'">{{
                      ex.status[t.status]
                    }}</span>
                  </a>
                </li>
              }
            </ul>
          </nav>
        </aside>

        <section class="min-w-0 space-y-4">
          <p class="text-sm" aria-live="polite">
            @if (g.notice()) {
              <span class="text-tone-brand">✓ {{ g.notice() }}</span>
            }
            @if (g.actionError()) {
              <span role="alert" class="text-tone-danger">{{ g.actionError() }}</span>
            }
          </p>
          @if (!id()) {
            <p class="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{{ ex.select }}</p>
          } @else if (g.topic.loading()) {
            <aula-spinner [label]="i18n.t().common.loading" />
          } @else if (g.topic.data(); as t) {
            <div class="flex flex-wrap items-center gap-2">
              <span class="badge" [class]="t.status === 'published' ? 'bg-tone-brand-soft text-tone-brand' : 'bg-tone-warning-soft text-tone-warning'">{{ ex.status[t.status] }}</span>
              @if (t.model) {
                <span class="badge bg-muted text-muted-foreground"><aula-icon name="sparkles" /> {{ t.model }}</span>
              }
              <span class="ml-auto flex flex-wrap gap-2">
                @if (t.status === 'draft') {
                  <button type="button" class="btn btn-primary btn-sm" [disabled]="g.busy()" (click)="g.setStatus(t.id, 'published')">✓ {{ ex.publish }}</button>
                } @else {
                  <button type="button" class="btn btn-outline btn-sm" [disabled]="g.busy()" (click)="g.setStatus(t.id, 'draft')">{{ ex.unpublish }}</button>
                }
                <button type="button" class="btn btn-outline btn-sm" [disabled]="g.busy()" (click)="enrich(t.id)"><aula-icon name="languages" /> {{ ex.enrich }}</button>
                <button type="button" class="btn btn-ghost btn-sm text-tone-danger" [disabled]="g.busy()" (click)="archive(t.id)">{{ ex.archive }}</button>
              </span>
            </div>

            <label class="block text-xs font-semibold">
              {{ ex.summary }}
              <span class="mt-1 flex gap-2">
                <input class="control w-full" maxlength="600" [value]="t.summary" #sum />
                <button type="button" class="btn btn-outline btn-sm" [disabled]="g.busy()" (click)="g.saveSummary(t.id, sum.value.trim())">{{ ex.save }}</button>
              </span>
            </label>

            <ol class="space-y-4">
              @for (s of t.sections; track s.id) {
                <li class="surface space-y-3 p-3">
                  <p class="text-xs font-bold uppercase tracking-wide text-muted-foreground"><aula-icon [name]="meta[s.type].icon" /> {{ tx.sections[s.type] }}</p>
                  <aula-grammar-section-form [section]="s" [busy]="g.busy()" [typeLabels]="tx.sections" [labels]="ex" (saved)="g.updateSection(t.id, s.id, $event)" />
                  <ul class="space-y-2 border-l-2 border-tone-brand-line pl-3">
                    @for (e of s.examples; track e.id) {
                      <li>
                        <aula-grammar-example-form
                          [example]="e"
                          [language]="t.language ?? 'en'"
                          [busy]="g.busy()"
                          [labels]="ex"
                          (saved)="g.updateExample(t.id, e.id, $event)"
                          (removed)="g.removeExample(t.id, e.id)"
                        />
                      </li>
                    }
                  </ul>
                  <aula-grammar-example-form [language]="t.language ?? 'en'" [busy]="g.busy()" [labels]="ex" (added)="g.addExample(t.id, s.id, $event)" />
                  <button type="button" class="btn btn-ghost btn-sm text-tone-danger" [disabled]="g.busy()" (click)="g.removeSection(t.id, s.id)">{{ ex.remove }}</button>
                </li>
              }
            </ol>
            <div class="rounded-xl border border-dashed border-border p-3">
              <aula-grammar-section-form [busy]="g.busy()" [typeLabels]="tx.sections" [labels]="ex" (saved)="g.addSection(t.id, $event)" />
            </div>

            <section aria-labelledby="ge-preview" class="border-t border-border pt-4">
              <h2 id="ge-preview" class="mb-3 text-sm font-bold"><aula-icon name="eye" /> {{ ex.preview }}</h2>
              <aula-grammar-card [topic]="t" [languageName]="i18n.languageName(t.language ?? '')" [sectionLabels]="tx.sections" [listenLabel]="tx.listen" [unreviewedLabel]="tx.unreviewed" />
            </section>
          }
        </section>
      </div>
    </aula-card-page>
  `,
})
export default class GrammarEditorPage {
  protected readonly i18n = inject(I18nService);
  protected readonly g = inject(GrammarFacade);
  private readonly router = inject(Router);
  private readonly returnTo = inject(ReturnToService); // [2026-10-23]: conserva ?volver= y regresa a Gestión
  readonly id = input<string>(); // `:id` de la ruta
  readonly idioma = input<string>(); // [2026-10-24]: ?idioma= (withComponentInputBinding)
  readonly nivel = input<string>(); // ?nivel=
  protected readonly meta = SECTION_META;
  protected readonly langs = LANGUAGES;
  protected readonly levels = CEFR_LEVELS;
  protected readonly title = signal('');
  protected readonly language = signal<(typeof LANGUAGES)[number]>('en');
  protected readonly level = signal<(typeof CEFR_LEVELS)[number]>('A1');
  protected readonly generating = signal(false);
  protected readonly valid = computed(
    () => TopicInputSchema.safeParse({ title: this.title(), language: this.language(), level: this.level() }).success,
  );

  constructor() {
    void this.g.loadTopics({}); // El personal recibe también los borradores
    effect(() => {
      const id = this.id();
      if (id) void this.g.loadTopic(id);
    });
    // [Prefill · 2026-10-24]: ficha nueva → idioma y nivel elegidos en Gestión
    effect(() => {
      const [language, level] = [pickLanguage(this.idioma()), pickLevel(this.nivel())];
      untracked(() => {
        if (language) this.language.set(language);
        if (level) this.level.set(level);
      });
    });
  }

  protected async create(withAi: boolean): Promise<void> {
    const input = { title: this.title().trim(), language: this.language(), level: this.level() };
    this.generating.set(withAi);
    const id = withAi ? await this.g.draft(input) : (await this.g.create(input))?.id;
    this.generating.set(false);
    if (!id) return;
    this.title.set('');
    void this.g.loadTopics({});
    void this.returnTo.go(['/gramatica/editor', id]);
  }

  protected async enrich(id: string): Promise<void> {
    const n = await this.g.enrich(id);
    if (n !== null) this.g.notice.set(this.i18n.t().grammar.editor.enriched.replace('{n}', String(n)));
  }

  protected async archive(id: string): Promise<void> {
    if (await this.g.archive(id)) void this.returnTo.leave('/gramatica/editor');
  }
}
