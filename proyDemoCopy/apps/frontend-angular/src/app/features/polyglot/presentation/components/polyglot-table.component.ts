import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Language } from '@aula/shared-schemas';
import type { TableRow } from '../../domain/models/polyglot';
import { AccentSwitchComponent } from '@shared/ui/molecules/accent-switch/accent-switch.component';
import { PolyglotCellComponent } from './polyglot-cell.component';
// [PolyglotTableComponent · Presentacional · Sprint 10.7 · RF-129/RF-130]: tabla comparativa — columna imagen (emoji o imagen con licencia) y una columna por idioma en el orden elegido (por defecto inglés, alemán, francés, portugués, ruso, chino y español) | [Patrón]: Presentational Component | [Principio]: SRP + accesibilidad (caption, `scope`, encabezados con `lang`, región desplazable enfocable) | [Paradigma]: Declarativo
// [Responsive]: en pantallas estrechas la página muestra PolyglotCards (esta tabla se oculta) · desplazamiento horizontal propio sin mover la página

@Component({
  selector: 'aula-polyglot-table',
  imports: [PolyglotCellComponent, AccentSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="overflow-x-auto rounded-2xl border border-border" tabindex="0" role="region" [attr.aria-label]="caption()">
      <table class="w-full min-w-[40rem] border-collapse text-left text-sm">
        <caption class="sr-only">{{ caption() }}</caption>
        <thead class="bg-gradient-to-r from-violet-50 to-fuchsia-50 dark:from-violet-950/40 dark:to-fuchsia-950/30">
          <tr>
            <th scope="col" class="w-20 px-3 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {{ imageLabel() }}
            </th>
            @for (l of languages(); track l) {
              <th scope="col" class="px-3 py-3 text-xs font-bold uppercase tracking-wide text-tone-brand" [attr.lang]="l">
                <span class="flex flex-wrap items-center gap-2">
                  {{ names()[l] ?? l }}
                  @if (l === 'en') {
                    <!-- [2026-10-19]: el interruptor UK/US vive EN la columna de inglés (cambia su IPA y su voz); antes estaba en la cabecera de la página -->
                    <aula-accent-switch class="normal-case tracking-normal" [label]="accentLabel()" />
                  }
                </span>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.concept.id) {
            <tr class="border-t border-border transition-colors hover:bg-muted/50">
              <th scope="row" class="px-3 py-3 align-top">
                @if (r.concept.imageUrl) {
                  <img
                    [src]="r.concept.imageUrl"
                    [alt]="r.concept.gloss"
                    [title]="r.concept.imageLicense ?? ''"
                    loading="lazy"
                    class="size-12 rounded-xl object-cover"
                  />
                } @else {
                  <span class="grid size-12 place-items-center rounded-xl bg-tone-brand-soft text-2xl" role="img" [attr.aria-label]="r.concept.gloss">{{
                    r.concept.emoji || '•'
                  }}</span>
                }
              </th>
              @for (l of languages(); track l) {
                <td class="px-3 py-3 align-top">
                  <aula-polyglot-cell
                    [term]="r.terms[l] ?? null"
                    [language]="l"
                    [languageName]="names()[l] ?? l"
                    [showReview]="showReview()"
                    [listenLabel]="listenLabel()"
                    [missingLabel]="missingLabel()"
                    [unreviewedLabel]="unreviewedLabel()"
                    [nativeLabel]="nativeLabel()"
                  />
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class PolyglotTableComponent {
  readonly rows = input.required<TableRow[]>();
  readonly languages = input.required<Language[]>();
  readonly names = input<Record<string, string>>({});
  readonly caption = input('');
  readonly accentLabel = input('Acento del inglés');
  readonly imageLabel = input('Imagen');
  readonly showReview = input(false);
  readonly listenLabel = input('Escuchar «{w}» en {l}');
  readonly missingLabel = input('Sin término');
  readonly unreviewedLabel = input('IPA automático sin revisar');
  readonly nativeLabel = input('Pendiente de revisión nativa');
}
