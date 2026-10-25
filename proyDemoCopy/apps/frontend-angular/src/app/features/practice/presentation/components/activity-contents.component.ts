import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { CONTENT_KINDS, CONTENT_ICON, type ActivityContent, type ContentKind } from '../../domain/models/practice';
import { ContentCatalogService, type ContentOption } from '../../infrastructure/content-catalog.service';
// [ActivityContentsComponent · Presentación · 2026-10-23]: contenidos que forman una actividad (p. ej. «Los alimentos» → vocabulario, un juego, una canción, un diálogo)
// Modo lectura: lista de enlaces con icono y tipo · Modo edición: elegir tipo → elegir de la lista (o escribir un enlace) → añadir; quitar; guardar
// [Patrón]: Presentational + Facade (ContentCatalogService) | [Principio]: SRP (guardar lo hace el contenedor) + DRY (constructor y reproductor) | [Paradigma]: Declarativo + Reactivo (signals)
// [A11y]: lista semántica; cada enlace dice su tipo en texto (no solo icono); botones con nombre accesible · `<a href>` (no routerLink): el destino puede ser otra app (Next.js)

export interface ContentsLabels {
  title: string;
  hint: string;
  empty: string;
  kinds: Record<ContentKind, string>;
  kind: string;
  pick: string;
  label: string;
  href: string;
  add: string;
  remove: string;
  save: string;
}

@Component({
  selector: 'aula-activity-contents',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let lb = labels();
    <section class="space-y-3 rounded-xl border border-border p-4" [attr.aria-label]="lb.title">
      <div>
        <h3 class="text-sm font-bold"><aula-icon name="package" /> {{ lb.title }}</h3>
        @if (editable()) {
          <p class="text-xs text-muted-foreground">{{ lb.hint }}</p>
        }
      </div>
      @if (list().length) {
        <ul class="grid gap-2 sm:grid-cols-2">
          @for (c of list(); track $index) {
            <li class="flex items-center gap-2 rounded-lg bg-muted p-2 text-sm">
              <aula-icon [name]="icon[c.kind]" [size]="18" />
              <a [href]="c.href" class="min-w-0 flex-1 font-semibold text-primary hover:underline">
                <span class="block truncate">{{ c.label }}</span>
                <span class="block text-xs font-normal text-muted-foreground">{{ lb.kinds[c.kind] }}</span>
              </a>
              @if (editable()) {
                <button type="button" class="btn btn-ghost btn-sm text-tone-danger" [attr.aria-label]="lb.remove + ': ' + c.label" (click)="remove($index)">✕</button>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="text-xs text-muted-foreground">{{ lb.empty }}</p>
      }

      @if (editable()) {
        <form class="grid gap-2 sm:grid-cols-[10rem_1fr_auto]" (submit)="$event.preventDefault(); add()">
          <label class="text-xs font-semibold text-muted-foreground">
            {{ lb.kind }}
            <select class="control mt-1 w-full" [value]="kind()" (change)="kind.set($any($event.target).value)">
              @for (k of kinds; track k) {
                <option [value]="k">{{ lb.kinds[k] }}</option>
              }
            </select>
          </label>
          @if (kind() === 'link') {
            <div class="grid gap-2 sm:grid-cols-2">
              <label class="text-xs font-semibold text-muted-foreground">
                {{ lb.label }}
                <input class="control mt-1 w-full" maxlength="160" [value]="label()" (input)="label.set($any($event.target).value)" />
              </label>
              <label class="text-xs font-semibold text-muted-foreground">
                {{ lb.href }}
                <input type="url" class="control mt-1 w-full" placeholder="https://…" [value]="href()" (input)="href.set($any($event.target).value)" />
              </label>
            </div>
          } @else {
            <label class="text-xs font-semibold text-muted-foreground">
              {{ lb.pick }}
              <select class="control mt-1 w-full" [value]="picked()" (change)="picked.set(+$any($event.target).value)" [disabled]="!options().length">
                @for (o of options(); track $index) {
                  <option [value]="$index">{{ o.label }}</option>
                }
              </select>
            </label>
          }
          <button type="submit" class="btn btn-outline self-end" [disabled]="!canAdd()">+ {{ lb.add }}</button>
        </form>
        <button type="button" class="btn btn-primary btn-sm" [disabled]="!dirty() || busy()" (click)="save.emit(list())"><aula-icon name="save" /> {{ lb.save }}</button>
      }
    </section>
  `,
})
export class ActivityContentsComponent {
  private readonly catalog = inject(ContentCatalogService);
  readonly contents = input<readonly ActivityContent[]>([]);
  readonly editable = input(false);
  readonly busy = input(false);
  readonly language = input('en');
  readonly level = input('A1');
  readonly labels = input.required<ContentsLabels>();
  readonly save = output<ActivityContent[]>();
  protected readonly kinds = CONTENT_KINDS;
  protected readonly icon = CONTENT_ICON;
  protected readonly list = signal<ActivityContent[]>([]);
  protected readonly dirty = signal(false);
  protected readonly kind = signal<ContentKind>('vocabulary');
  protected readonly options = signal<ContentOption[]>([]);
  protected readonly picked = signal(0);
  protected readonly label = signal('');
  protected readonly href = signal('');

  constructor() {
    // Contenidos guardados → lista local (se edita sin tocar el servidor hasta «Guardar»)
    effect(() => {
      this.list.set([...this.contents()]);
      this.dirty.set(false);
    });
    // Cambiar de tipo, idioma o nivel → nuevas opciones del catálogo
    effect(() => {
      const [k, lang, lv] = [this.kind(), this.language(), this.level()];
      this.options.set([]);
      this.picked.set(0);
      if (k !== 'link') void this.catalog.options(k, lang, lv).then((o) => this.options.set(o));
    });
  }

  protected canAdd(): boolean {
    return this.kind() === 'link' ? this.label().trim().length > 0 && /^https:\/\/\S+$/.test(this.href().trim()) : this.options().length > 0;
  }

  protected add(): void {
    const k = this.kind();
    const o = this.options()[this.picked()];
    const item: ActivityContent | undefined = k === 'link' ? { kind: k, label: this.label().trim(), href: this.href().trim() } : o && { kind: k, ...o };
    if (!item || this.list().some((c) => c.href === item.href)) return; // Sin duplicados
    this.list.update((l) => [...l, item].slice(0, 20)); // Máx. 20 (= ArrayMaxSize del backend)
    this.dirty.set(true);
    this.label.set('');
    this.href.set('');
  }

  protected remove(i: number): void {
    this.list.update((l) => l.filter((_, j) => j !== i));
    this.dirty.set(true);
  }
}
