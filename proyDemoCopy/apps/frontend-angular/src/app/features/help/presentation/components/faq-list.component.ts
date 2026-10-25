import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Dict } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import type { Faq } from '../../domain/models/help';
// [FaqListComponent · Presentacional]: acordeón accesible de preguntas frecuentes | [Patrón]: Presentational Component (input()/output()) | [Principio]: SRP + Native first (<details>/<summary>: teclado, foco y estado abierto sin JS) | [Paradigma]: Declarativo
// [A11y]: <summary> es botón nativo con estado expandido anunciado · categoría y rol en texto · acciones ADMIN con el nombre de la pregunta

@Component({
  selector: 'aula-faq-list',
  imports: [BadgeComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = t();
    <ul class="divide-y divide-border rounded-xl border border-border">
      @for (f of faqs(); track f.id) {
        <li>
          <details class="group p-4" [id]="'faq-' + f.id" [open]="f.id === openId()">
            <summary class="flex cursor-pointer list-none items-start justify-between gap-3 rounded font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span>{{ f.question }}</span>
              <span aria-hidden="true" class="mt-0.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none">▾</span>
            </summary>
            <div class="mt-3 space-y-3 text-sm">
              <p class="whitespace-pre-line">{{ f.answer }}</p>
              <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <aula-badge tone="brand">{{ f.category }}</aula-badge>
                <aula-badge>{{ tx.roles[f.role] }}</aula-badge>
                <span>{{ reviewedLabel()(f.reviewedAt) }}</span>
                @if (f.manualSlug) {
                  <a class="text-primary hover:underline" [href]="'/ayuda/manual/' + f.manualSlug">{{ tx.readManual }}</a>
                }
              </div>
              @if (admin()) {
                <div class="flex gap-2">
                  <button aulaButton variant="outline" size="sm" type="button" [attr.aria-label]="tx.edit + ': ' + f.question" (click)="edit.emit(f)">{{ tx.edit }}</button>
                  <button aulaButton variant="ghost" size="sm" type="button" class="text-tone-danger" [attr.aria-label]="tx.archive + ': ' + f.question" (click)="archive.emit(f)">{{ tx.archive }}</button>
                </div>
              }
            </div>
          </details>
        </li>
      } @empty {
        <li class="p-6 text-center text-sm text-muted-foreground">{{ tx.empty }}</li>
      }
    </ul>
  `,
})
export class FaqListComponent {
  readonly faqs = input.required<Faq[]>();
  readonly t = input.required<Dict['help']>();
  readonly admin = input(false);
  readonly openId = input<string | undefined>(); // /ayuda/faq/:id abre esa pregunta
  readonly reviewedLabel = input.required<(iso: string) => string>(); // La página formatea la fecha en el idioma activo
  readonly edit = output<Faq>();
  readonly archive = output<Faq>();
}
