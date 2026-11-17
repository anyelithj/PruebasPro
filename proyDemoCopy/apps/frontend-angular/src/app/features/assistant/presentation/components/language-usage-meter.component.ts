import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { usagePercent, type LanguageUsage } from '../../domain/models/assistant';
// [LanguageUsageMeterComponent · Presentación · 2026-10-28]: indicador «Uso del idioma: 45 % / meta 60 %» con barra y marca de la meta del nivel | [Patrón]: Presentational Component | [Principio]: SRP (solo pinta; FastAPI mide) | [Paradigma]: Declarativo + Reactivo (computed)
// [A11y]: role="meter" con aria-valuenow/min/max/valuetext (el lector dice «45 % de 60 %») · estado en texto (no solo color) · aria-live="polite" → se anuncia al cambiar

@Component({
  selector: 'aula-language-usage-meter',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let t = i18n.t().assistant;
    <section class="rounded-xl border border-border bg-card px-4 py-3 text-sm" [attr.aria-label]="t.usageLabel" aria-live="polite">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <p class="flex items-center gap-1.5 font-bold"><aula-icon name="target" [size]="16" /> {{ t.usageLabel }}</p>
        <p class="font-semibold tabular-nums" [class]="tone()">{{ value() }}</p>
      </div>
      <!-- [Barra]: relleno = % actual · línea vertical = meta del nivel | \`motion-safe\`: sin animación si el usuario la reduce -->
      <div
        role="meter"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="pct()"
        [attr.aria-valuetext]="value()"
        [attr.aria-label]="t.usageLabel"
        class="relative mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div class="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500" [class]="usage()?.below ? 'bg-tone-warning' : 'bg-tone-brand'" [style.width.%]="pct()"></div>
        <span class="absolute inset-y-0 w-0.5 bg-foreground/70" [style.left.%]="goalPct()" aria-hidden="true"></span>
      </div>
      <p class="mt-1.5 type-meta text-muted-foreground">{{ hint() }}</p>
    </section>
  `,
})
export class LanguageUsageMeterComponent {
  protected readonly i18n = inject(I18nService);
  readonly usage = input<LanguageUsage | null>(null);
  readonly goal = input.required<number>(); // 0–1 (meta del servidor o la tabla espejo del nivel)
  readonly languageName = input.required<string>();

  protected readonly pct = computed(() => usagePercent(this.usage()?.ratio ?? 0));
  protected readonly goalPct = computed(() => usagePercent(this.goal()));
  private readonly measured = computed(() => (this.usage()?.turns ?? 0) > 0); // Antes del aviso del tutor no hay medición
  protected readonly value = computed(() => this.i18n.fmt(this.i18n.t().assistant.usageValue, { pct: this.measured() ? this.pct() : 0, goal: this.goalPct() }));
  protected readonly tone = computed(() => (!this.measured() ? 'text-muted-foreground' : this.usage()?.below ? 'text-tone-warning' : 'text-tone-brand'));
  protected readonly hint = computed(() => {
    const t = this.i18n.t().assistant;
    const vars = { lang: this.languageName(), goal: this.goalPct() };
    if (!this.measured()) return this.i18n.fmt(t.usagePending, vars);
    return this.i18n.fmt(this.usage()?.below ? t.usageBelow : t.usageOk, vars);
  });
}
