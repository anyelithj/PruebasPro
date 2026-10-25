import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CdkDrag, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { I18nService } from '@core/i18n/i18n.service';
import { GamesFacade } from '../../application/games.facade';
import { CategoryBucketComponent } from '../components/category-bucket.component';
import { GameShellComponent } from '../components/game-shell.component';
// [QuickSortPage · Presentación · Sprint 8.8]: /juegos/clasificar — clasificar palabras por categoría arrastrando (CDK DragDrop) o con teclado (elegir palabra → botón del grupo) | [Patrón]: Container (smart) + Observer (eventos de los grupos) | [Principio]: SRP + accesibilidad (WCAG 2.5.7: alternativa sin arrastre) | [Paradigma]: Declarativo + Reactivo
// [Ronda]: `answer` = categoría elegida, `expected: 'category'` → NestJS compara con la categoría del banco propio (CC BY)

@Component({
  selector: 'aula-quick-sort-page',
  imports: [GameShellComponent, CategoryBucketComponent, CdkDropListGroup, CdkDropList, CdkDrag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().games;
    @let gl = games.session()?.language ?? 'en';
    <aula-game-shell
      [type]="'quick_sort'"
      [lang]="lang()"
      [lvl]="level()"
      [diff]="d()"
      (started)="reset()"
    >
      <!-- cdkDropListGroup: conecta la lista de palabras con todos los grupos sin enumerar ids -->
      <div cdkDropListGroup class="space-y-4">
        <ul
          cdkDropList
          id="sort-pool"
          class="flex min-h-14 flex-wrap gap-2 rounded-2xl border border-border p-3"
          [attr.aria-label]="tx.names.quick_sort"
        >
          @for (i of pending(); track i) {
            <li cdkDrag [cdkDragData]="i" class="cursor-grab active:cursor-grabbing">
              <button
                type="button"
                class="chip text-sm"
                [attr.aria-pressed]="selected() === i"
                [attr.lang]="gl"
                (click)="selected.set(selected() === i ? null : i)"
              >
                {{ items()[i].emoji }} {{ items()[i].term }}
              </button>
            </li>
          }
        </ul>
        @if (selected() !== null) {
          <p class="text-sm font-semibold" aria-live="polite">
            {{ i18n.fmt(tx.pickBucket, { word: items()[selected()!].term }) }}
          </p>
        }
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          @for (c of categories(); track c) {
            <aula-category-bucket
              [name]="c"
              [listId]="'bucket-' + $index"
              [placed]="placed()[c] ?? []"
              [selected]="selected() !== null"
              [language]="gl"
              [dropLabel]="tx.dropHere"
              (dropped)="place($event.index, $event.category)"
              (chosen)="place(selected()!, $event)"
            />
          }
        </div>
      </div>
    </aula-game-shell>
  `,
})
export default class QuickSortPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  readonly lang = input<string>();
  readonly level = input<string>();
  readonly d = input<string>();
  protected readonly items = computed(() => this.games.session()?.content.vocabulary ?? []);
  // `new Set(...)`: categorías únicas en el orden en que aparecen
  protected readonly categories = computed(() => [
    ...new Set(this.items().map((w) => w.category ?? '—')),
  ]);
  protected readonly done = signal(new Set<number>());
  protected readonly pending = computed(() =>
    this.items()
      .map((_, i) => i)
      .filter((i) => !this.done().has(i)),
  );
  protected readonly placed = signal<Record<string, { term: string; ok: boolean }[]>>({});
  protected readonly selected = signal<number | null>(null);

  protected reset(): void {
    this.done.set(new Set());
    this.placed.set({});
    this.selected.set(null);
  }

  protected async place(index: number, category: string): Promise<void> {
    if (this.done().has(index)) return;
    const r = await this.games.answer({
      answer: category,
      entryIndex: index,
      expected: 'category',
    });
    if (!r) return;
    const term = this.items()[index].term;
    this.done.update((d) => new Set(d).add(index));
    this.placed.update((p) => ({
      ...p,
      [category]: [...(p[category] ?? []), { term, ok: !!r.verdict.correct }],
    }));
    this.selected.set(null);
    if (this.done().size === this.items().length) void this.games.finish();
  }
}
