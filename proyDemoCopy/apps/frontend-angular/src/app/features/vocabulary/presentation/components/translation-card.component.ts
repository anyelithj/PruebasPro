import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { I18nService, type Dict } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { IpaLabelComponent } from '@shared/ui/atoms/ipa-label/ipa-label.component';
import { AccentSwitchComponent } from '@shared/ui/molecules/accent-switch/accent-switch.component';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
import type { Lookup } from '../../domain/models/vocabulary';
// [TranslationCardComponent · Presentacional · Sprint 8.3]: traducción, alternativas, IPA UK/US (o única variante) y sonido | [Patrón]: Presentational Component + Atomic Design (compone átomos y moléculas) | [Principio]: SRP + DRY | [Paradigma]: Declarativo + Reactivo
// [UX]: en inglés se ven las DOS transcripciones; la del acento activo se resalta y es la que suena · [A11y]: cada IPA con su etiqueta en texto («IPA británico»), aviso de IA caída en role="status"

@Component({
  selector: 'aula-translation-card',
  imports: [
    BadgeComponent,
    ButtonComponent,
    IpaLabelComponent,
    AccentSwitchComponent,
    PronunciationButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    @let tx = t();
    @let r = lookup().result;
    <!-- [Compacta · Fix 2026-10-31]: palabra y sonido en una línea; IPA y traducción en la MISMA fila desde lg (antes apilados, con mucha altura) | apilados en móvil -->
    <article class="space-y-2" aria-live="polite">
      <header class="flex flex-wrap items-center gap-2">
        <div class="flex min-w-0 flex-wrap items-baseline gap-2">
          <p class="type-meta font-semibold uppercase tracking-wider text-muted-foreground">
            {{ i18n.languageName(lang()) }}
          </p>
          <h2 class="title-section break-words" [attr.lang]="lang()">
            {{ lookup().text }}
          </h2>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <aula-pronunciation-button
            [text]="lookup().text"
            [language]="lang()"
            [label]="tx.listen"
          />
          @if (lang() === 'en') {
            <aula-accent-switch [label]="tx.accent" />
          }
        </div>
      </header>

      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <!-- [IPA]: inglés → UK y US (la activa con borde de marca); otros idiomas → una sola -->
        @if (lang() === 'en') {
          @for (v of variants(); track v.key) {
            <section
              class="rounded-xl border px-3 py-1.5 transition-colors"
              [class]="speech.accent() === v.key ? 'border-primary bg-tone-brand-soft' : 'border-border'"
              [attr.aria-label]="v.label"
            >
              <h3 class="type-meta font-semibold text-muted-foreground">{{ v.label }}</h3>
              <p><aula-ipa-label [ipa]="v.ipa" language="en" [title]="v.label" [text]="lookup().text" /></p>
            </section>
          }
        } @else {
          <section class="rounded-xl border border-border px-3 py-1.5" [attr.aria-label]="tx.ipa">
            <h3 class="type-meta font-semibold text-muted-foreground">{{ tx.ipa }}</h3>
            <p><aula-ipa-label [ipa]="r.ipa" [language]="lang()" [text]="lookup().text" /></p>
          </section>
        }
        <section class="rounded-xl border border-border px-3 py-1.5">
          <h3 class="type-meta font-semibold text-muted-foreground">{{ tx.translation }}</h3>
          @if (aiDown()) {
            <p role="status" class="text-tone-warning">{{ tx.aiUnavailable }}</p>
          } @else {
            <p class="font-semibold text-foreground" lang="es">
              {{ r.translation.translation }}
            </p>
            @if (r.translation.alternatives.length) {
              <p class="type-meta text-muted-foreground">
                {{ tx.alternatives }}:
                <span lang="es">{{ r.translation.alternatives.join(' · ') }}</span>
              </p>
            }
          }
        </section>
      </div>

      <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <p class="flex flex-wrap items-center gap-2 type-meta text-muted-foreground">
          {{ i18n.fmt(tx.engine, { engine: r.engine || 'espeak-ng' }) }}
          @if (lookup().hits > 0) {
            <aula-badge tone="info">{{ tx.cached }}</aula-badge>
          }
        </p>
        <button
          aulaButton
          variant="outline"
          size="sm"
          type="button"
          [loading]="saving()"
          (click)="save.emit(lookup())"
        >
          {{ tx.saveToBank }}
        </button>
      </footer>
    </article>
  `,
})
export class TranslationCardComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly speech = inject(SpeechSynthesisService);
  readonly t = input.required<Dict['vocabulary']>();
  readonly lookup = input.required<Lookup>();
  readonly saving = input(false);
  readonly save = output<Lookup>();

  protected readonly lang = computed(() => this.lookup().language);
  // `model === 'unavailable'` o traducción vacía → la IA no respondió (el IPA sí es válido)
  protected readonly aiDown = computed(() => {
    const tr = this.lookup().result.translation;
    return tr.model === 'unavailable' || !tr.translation.trim();
  });
  protected readonly variants = computed(() => {
    const r = this.lookup().result;
    return [
      { key: 'uk' as const, label: this.t().ipaUk, ipa: r.ipa_uk },
      { key: 'us' as const, label: this.t().ipaUs, ipa: r.ipa_us },
    ];
  });
}
