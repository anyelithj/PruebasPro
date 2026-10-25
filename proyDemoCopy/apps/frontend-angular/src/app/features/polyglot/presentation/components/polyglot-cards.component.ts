import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Language } from '@aula/shared-schemas';
import type { TableRow } from '../../domain/models/polyglot';
import { PolyglotCellComponent } from './polyglot-cell.component';
// [PolyglotCardsComponent · Presentacional · Sprint 10.7 · RF-129]: vista de tarjetas para pantallas estrechas — una tarjeta por concepto con el emoji arriba y los idiomas en el orden elegido | [Patrón]: Presentational Component | [Principio]: SRP + DRY (misma celda que la tabla) + responsive (sin desplazamiento horizontal en móviles) | [Paradigma]: Declarativo

@Component({
  selector: 'aula-polyglot-cards',
  imports: [PolyglotCellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="grid gap-3 sm:grid-cols-2" [attr.aria-label]="label()">
      @for (r of rows(); track r.concept.id) {
        <li class="surface overflow-hidden">
          <div class="flex items-center gap-3 border-b border-border bg-gradient-to-r from-violet-50 to-fuchsia-50 px-4 py-3 dark:from-violet-950/40 dark:to-fuchsia-950/30">
            <span class="text-3xl" aria-hidden="true">{{ r.concept.emoji || '•' }}</span>
            <span class="text-sm font-semibold text-muted-foreground" lang="es">{{ r.concept.gloss }}</span>
          </div>
          <dl class="divide-y divide-border">
            @for (l of languages(); track l) {
              <div class="grid grid-cols-[5.5rem_1fr] items-start gap-2 px-4 py-2.5">
                <dt class="pt-1 text-[11px] font-bold uppercase tracking-wide text-tone-brand">{{ names()[l] ?? l }}</dt>
                <dd>
                  <aula-polyglot-cell
                    [term]="r.terms[l] ?? null"
                    [language]="l"
                    [languageName]="names()[l] ?? l"
                    [listenLabel]="listenLabel()"
                    [missingLabel]="missingLabel()"
                    [nativeLabel]="nativeLabel()"
                  />
                </dd>
              </div>
            }
          </dl>
        </li>
      }
    </ul>
  `,
})
export class PolyglotCardsComponent {
  readonly rows = input.required<TableRow[]>();
  readonly languages = input.required<Language[]>();
  readonly names = input<Record<string, string>>({});
  readonly label = input('');
  readonly listenLabel = input('Escuchar «{w}» en {l}');
  readonly missingLabel = input('Sin término');
  readonly nativeLabel = input('Pendiente de revisión nativa');
}
