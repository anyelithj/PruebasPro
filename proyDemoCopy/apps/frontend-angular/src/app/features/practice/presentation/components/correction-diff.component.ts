import { ChangeDetectionStrategy, Component, input } from '@angular/core';
// [CorrectionDiffComponent · Presentacional · Sprint 8.14]: lo escrito tachado y la corrección al lado | [Patrón]: Presentational Component | [Principio]: SRP | [Paradigma]: Declarativo
// [A11y]: <del>/<ins> semánticos (los lectores anuncian «eliminado» / «insertado») + flecha en texto, no solo color

@Component({
  selector: 'aula-correction-diff',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex flex-wrap items-baseline gap-1.5" [attr.lang]="language()">
      <del class="rounded bg-tone-danger-soft px-1 text-tone-danger decoration-2">{{
        original()
      }}</del>
      <span aria-hidden="true">→</span>
      <ins class="rounded bg-tone-brand-soft px-1 font-semibold text-tone-brand no-underline">{{
        correction() || '∅'
      }}</ins>
    </span>
  `,
})
export class CorrectionDiffComponent {
  readonly original = input.required<string>();
  readonly correction = input.required<string>();
  readonly language = input('en');
}
