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
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { AccentSwitchComponent } from '@shared/ui/molecules/accent-switch/accent-switch.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { VocabularyEntryFacade } from '../../application/vocabulary-entry.facade';
import {
  VOCAB_LANGUAGES,
  type EntryPatch,
  type VocabularyEntry,
} from '../../domain/models/vocabulary';
import { VocabularyEntryFormComponent } from '../components/vocabulary-entry-form.component';
import { VocabularyEntryTableComponent } from '../components/vocabulary-entry-table.component';
// [VocabularyEntryPage · Presentación · Sprint 8.3]: /vocabulario (banco con filtros + alta) y /vocabulario/:id (corrección de una entrada) | [Patrón]: Container (smart) + Master-Detail en una página | [Principio]: SRP + DIP (fachada) + DRY (un formulario para crear y corregir) | [Paradigma]: Declarativo + Reactivo
// [A11y]: filtros con etiqueta, confirmación antes de borrar, errores en role="alert" · [Responsive]: filtros apilados en móvil

@Component({
  selector: 'aula-vocabulary-entry-page',
  imports: [
    RouterLink,
    CardPageTemplate,
    ButtonComponent,
    SpinnerComponent,
    AccentSwitchComponent,
    VocabularyEntryFormComponent,
    VocabularyEntryTableComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().vocabulary;
    <aula-card-page [heading]="tx.bankTitle" [subtitle]="tx.bankSubtitle">
      <div pageActions class="flex flex-wrap items-center gap-2">
        <aula-accent-switch [label]="tx.accent" />
        <a aulaButton variant="outline" size="sm" routerLink="/traductor">{{
          tx.openTranslator
        }}</a>
        <a aulaButton variant="outline" size="sm" href="/juegos/flashcards">{{ tx.flashcards }}</a>
      </div>

      @if (facade.actionError(); as err) {
        <p role="alert" class="mb-3 text-sm text-tone-danger">{{ err }}</p>
      }

      <!-- [Detalle]: corrección de la entrada abierta (ruta /vocabulario/:id) -->
      @if (id()) {
        <div class="mb-6 rounded-xl border border-primary/40 bg-gradient-soft p-4">
          @switch (facade.selected.status()) {
            @case ('loading') {
              <aula-spinner [label]="i18n.t().common.loading" />
            }
            @case ('error') {
              <p role="alert" class="text-sm text-tone-danger">{{ facade.selected.error() }}</p>
            }
            @case ('success') {
              <aula-vocabulary-entry-form
                [t]="tx"
                [entry]="facade.selected.data()"
                [busy]="facade.busy()"
                (patched)="correct($event)"
                (cancelled)="close()"
              />
            }
          }
        </div>
      } @else {
        <div class="mb-6 rounded-xl border border-border p-4">
          <aula-vocabulary-entry-form
            [t]="tx"
            [busy]="facade.busy()"
            (created)="facade.add($event)"
          />
        </div>
      }

      <!-- [Filtros]: idioma + texto; buscar relee la lista -->
      <form
        class="mb-4 grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-end"
        role="search"
        (submit)="search($event)"
      >
        <label class="text-xs font-semibold text-muted-foreground">
          {{ tx.language }}
          <select
            class="control mt-1 w-full"
            [value]="language()"
            (change)="language.set($any($event.target).value)"
          >
            <option value="">{{ tx.allLanguages }}</option>
            @for (code of languages; track code) {
              <option [value]="code">{{ i18n.languageName(code) }}</option>
            }
          </select>
        </label>
        <label class="text-xs font-semibold text-muted-foreground">
          {{ tx.search }}
          <input
            type="search"
            class="control mt-1 w-full"
            [value]="q()"
            (input)="q.set($any($event.target).value)"
          />
        </label>
        <button aulaButton variant="outline" type="submit">{{ tx.search }}</button>
      </form>

      @switch (facade.list.status()) {
        @case ('loading') {
          <aula-spinner [label]="i18n.t().common.loading" />
        }
        @case ('error') {
          <p role="alert" class="text-sm text-tone-danger">{{ facade.list.error() }}</p>
        }
        @case ('empty') {
          <p
            class="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
          >
            {{ tx.emptyBank }}
          </p>
        }
        @case ('success') {
          <p class="mb-2 text-xs text-muted-foreground">
            {{ i18n.fmt(tx.count, { n: facade.list.data()!.length }) }}
          </p>
          <aula-vocabulary-entry-table
            [t]="tx"
            [items]="facade.list.data()!"
            [selectedId]="id() ?? null"
            [busy]="facade.busy()"
            (edit)="open($event)"
            (remove)="remove($event)"
          />
        }
      }
    </aula-card-page>
  `,
})
export default class VocabularyEntryPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(VocabularyEntryFacade);
  private readonly router = inject(Router);
  readonly id = input<string>(); // /vocabulario/:id
  protected readonly languages = VOCAB_LANGUAGES;
  protected readonly language = signal('');
  protected readonly q = signal('');

  constructor() {
    void this.facade.load({});
    // `effect`: al cambiar :id se carga la entrada a corregir
    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.facade.open(id));
    });
  }

  protected search(e: Event): void {
    e.preventDefault();
    void this.facade.load({ language: this.language() || undefined, q: this.q() || undefined });
  }

  protected open(e: VocabularyEntry): void {
    void this.router.navigate(['/vocabulario', e.id]);
  }

  protected close(): void {
    void this.router.navigate(['/vocabulario']);
  }

  protected async correct(ev: { id: string; patch: EntryPatch }): Promise<void> {
    if (await this.facade.correct(ev.id, ev.patch)) this.close();
  }

  protected remove(e: VocabularyEntry): void {
    // `confirm` (DOM): diálogo nativo accesible (foco y teclado del navegador) antes de una acción destructiva
    if (confirm(this.i18n.fmt(this.i18n.t().vocabulary.confirmRemove, { term: e.term })))
      void this.facade.remove(e.id);
  }
}
