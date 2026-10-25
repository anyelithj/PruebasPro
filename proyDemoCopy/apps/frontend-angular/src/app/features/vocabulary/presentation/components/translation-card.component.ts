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
    <article class="space-y-5" aria-live="polite">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {{ i18n.languageName(lang()) }}
          </p>
          <h2 class="break-words text-2xl font-extrabold tracking-tight" [attr.lang]="lang()">
            {{ lookup().text }}
          </h2>
        </div>
        <div class="flex items-center gap-2">
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

      <!-- [IPA]: inglés → UK y US lado a lado (la activa con borde de marca); otros idiomas → una sola -->
      <section [attr.aria-label]="tx.ipa">
        <h3 class="mb-2 text-sm font-bold">{{ tx.ipa }}</h3>
        @if (lang() === 'en') {
          <div class="grid gap-2 sm:grid-cols-2">
            @for (v of variants(); track v.key) {
              <div
                class="rounded-xl border p-3 transition-colors"
                [class]="
                  speech.accent() === v.key ? 'border-primary bg-tone-brand-soft' : 'border-border'
                "
              >
                <p class="text-xs font-semibold text-muted-foreground">{{ v.label }}</p>
                <p class="text-lg">
                  <aula-ipa-label [ipa]="v.ipa" language="en" [title]="v.label" />
                </p>
              </div>
            }
          </div>
        } @else {
          <p class="text-lg"><aula-ipa-label [ipa]="r.ipa" [language]="lang()" /></p>
        }
      </section>

      <section>
        <h3 class="mb-1 text-sm font-bold">{{ tx.translation }}</h3>
        @if (aiDown()) {
          <p role="status" class="text-sm text-tone-warning">{{ tx.aiUnavailable }}</p>
        } @else {
          <p class="text-xl font-semibold text-foreground" lang="es">
            {{ r.translation.translation }}
          </p>
          @if (r.translation.alternatives.length) {
            <p class="mt-1 text-sm text-muted-foreground">
              {{ tx.alternatives }}:
              <span lang="es">{{ r.translation.alternatives.join(' · ') }}</span>
            </p>
          }
        }
      </section>

      <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
  // `model === 'unavailable'` o traducción vacía → la IA local no respondió (el IPA sí es válido)
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
