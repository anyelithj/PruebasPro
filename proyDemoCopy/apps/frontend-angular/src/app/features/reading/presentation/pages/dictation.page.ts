import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { I18nService } from '@core/i18n/i18n.service';
import { ReturnLinkComponent } from '@core/layout/return-to';
import { CorrectionErrorsComponent } from '@features/own-llm/presentation/components/correction-errors.component';
import { OwnLlmRepository } from '@features/own-llm/domain/own-llm.repository.port';
import { OwnLlmHttpRepository } from '@features/own-llm/infrastructure/own-llm.http-repository';
import type { CorrectorResult } from '@features/own-llm/domain/models/own-llm';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { FilterPanelComponent } from '@shared/ui/molecules/filter-panel/filter-panel.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { ReadingViewsComponent } from '../components/reading-views.component'; // [2026-11-16]: pills Lecturas · Dictado · Libros clásicos
import { ReadingFacade } from '../../application/reading.facade';
import { diffWords, dictationScore, type DiffToken } from '../../domain/models/dictation';
// [DictationPage · Presentación · Lectura → Dictado · 2026-11-16]: /lectura/dictado — se elige una lectura publicada, se ESCUCHA cada frase (voz del navegador) y se escribe
// Al comprobar: (1) comparación palabra por palabra con la frase dictada (bien · mal escrita · falta · sobra) y (2) feedback del MISMO corrector único que puntúa los turnos
// de Diálogos y usa el Corrector de ortografía (POST /ai/own-llm/corrections · Anexo A) · al final, resumen con todas las correcciones
// [Reutiliza]: ReadingFacade (lecturas y frases), SpeechSynthesisService (voz), OwnLlmRepository + CorrectionErrorsComponent (corrector y su lista de errores), FilterPanel
// [Patrón]: Container + Facade + Ports & Adapters | [Principio]: DRY + SRP (la comparación es una función pura del dominio) | [Paradigma]: Reactivo (signals)
// [A11y]: <textarea> con <label> y `lang` del idioma, resultados en aria-live, cada marca con texto (no solo color, WCAG 1.4.1), botones nativos

interface DictationResult {
  sentence: string;
  typed: string;
  tokens: DiffToken[];
  score: number;
  correction: CorrectorResult | null; // null = el corrector no respondió (queda la comparación)
}

const TOKEN_CLS: Record<DiffToken['kind'], string> = {
  ok: 'text-tone-success',
  wrong: 'rounded bg-tone-danger-soft px-0.5 text-tone-danger line-through decoration-2',
  missing: 'rounded border border-dashed border-tone-warning px-0.5 text-tone-warning',
  extra: 'rounded bg-muted px-0.5 text-muted-foreground line-through',
};

@Component({
  selector: 'aula-dictation-page',
  imports: [CardPageTemplate, ReturnLinkComponent, ReadingViewsComponent, FilterPanelComponent, SpinnerComponent, IconComponent, CorrectionErrorsComponent],
  providers: [{ provide: OwnLlmRepository, useClass: OwnLlmHttpRepository }], // Mismo corrector que Diálogos (sin cargar la ruta /redaccion)
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = i18n.t().dictation;
    <aula-card-page [heading]="tx.title" [subtitle]="tx.subtitle" [bare]="true">
      <aula-return-link pageBack fallback="/lectura" [label]="i18n.t().reading.backToList" />
      <aula-filter-panel [showSearch]="false" [(level)]="level" [(language)]="language" [languageAll]="false">
        <label class="filter-field" style="flex-grow: 2; min-width: 14rem">
          {{ tx.text }}
          <select class="control" [value]="textId()" (change)="textId.set($any($event.target).value)">
            @for (r of reading.list.data() ?? []; track r.id) {
              <option [value]="r.id" [selected]="r.id === textId()">{{ r.title }} · {{ r.level }}</option>
            }
          </select>
        </label>
      </aula-filter-panel>
      <!-- [2026-11-16]: pills Lecturas · Dictado · Libros clásicos DEBAJO del panel de filtros, una al lado de la otra -->
      <aula-reading-views class="mb-4 block" />

      @if (reading.list.status() === 'loading' || reading.text.status() === 'loading') {
        <aula-spinner [label]="i18n.t().common.loading" />
      } @else if (reading.list.status() === 'empty') {
        <p role="status" class="rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground">{{ tx.empty }}</p>
      } @else if (reading.text.error(); as err) {
        <p role="alert" class="text-tone-danger">{{ err }}</p>
      } @else if (sentences().length && !finished()) {
        @let lang = reading.text.data()?.language ?? language();
        <section class="surface space-y-4 p-4" aria-labelledby="dictation-step">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 id="dictation-step" class="title-card">{{ i18n.fmt(tx.sentenceN, { n: index() + 1, total: sentences().length }) }}</h2>
            <progress class="w-40" [max]="sentences().length" [value]="index()" [attr.aria-label]="tx.progress"></progress>
          </div>
          <p class="type-meta text-muted-foreground">{{ tx.hint }}</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn btn-primary btn-sm" (click)="listen(0.85)"><aula-icon name="volume-2" /> {{ tx.listen }}</button>
            <button type="button" class="btn btn-outline btn-sm" (click)="listen(0.6)">🐢 {{ tx.slower }}</button>
          </div>
          <label class="flex flex-col gap-1 text-sm font-medium">
            {{ tx.answer }}
            <textarea
              class="control min-h-24"
              [attr.lang]="lang"
              spellcheck="false"
              autocapitalize="off"
              autocomplete="off"
              [disabled]="!!current()"
              [value]="typed()"
              (input)="typed.set($any($event.target).value)"
              (keydown.control.enter)="check()"
            ></textarea>
          </label>
          @if (!current()) {
            <button type="button" class="btn btn-primary" [disabled]="!typed().trim()" (click)="check()">{{ tx.check }}</button>
          }

          @if (current(); as c) {
            <div aria-live="polite" class="space-y-3 rounded-xl border border-border bg-card p-3">
              <p class="flex flex-wrap items-center gap-2">
                <span class="badge" [class]="c.score >= 80 ? 'bg-tone-success-soft text-tone-success' : 'bg-tone-warning-soft text-tone-warning'">{{ i18n.fmt(tx.score, { n: c.score }) }}</span>
                <span class="type-meta text-muted-foreground">{{ tx.legend }}</span>
              </p>
              <p [attr.lang]="lang" class="text-lg leading-relaxed">
                @for (t of c.tokens; track $index) {
                  <span [class]="cls[t.kind]" [title]="tx.kinds[t.kind]">{{ t.text }}</span>
                  @if (t.kind === 'wrong') {
                    <span class="text-tone-success"> ({{ t.expected }})</span>
                  }
                  <span class="sr-only"> · {{ tx.kinds[t.kind] }}</span>
                  {{ ' ' }}
                }
              </p>
              <p class="type-meta"><b>{{ tx.original }}:</b> <span [attr.lang]="lang">{{ c.sentence }}</span></p>
              @if (checking()) {
                <aula-spinner [label]="tx.checking" />
              } @else if (c.correction; as k) {
                <div class="space-y-1">
                  <h3 class="font-semibold">{{ tx.feedback }}</h3>
                  @if (k.correccion.errores.length) {
                    <aula-correction-errors [errors]="k.correccion.errores" [language]="lang" />
                    <p class="type-meta"><b>{{ tx.corrected }}:</b> <span [attr.lang]="lang">{{ k.correccion.frase_corregida }}</span></p>
                  } @else {
                    <p class="text-tone-success">{{ tx.noErrors }}</p>
                  }
                  @if (k.correccion.comentario) {
                    <p lang="es" class="type-meta text-muted-foreground">{{ k.correccion.comentario }}</p>
                  }
                </div>
              } @else {
                <p class="type-meta text-muted-foreground">{{ tx.noFeedback }}</p>
              }
              @if (!checking()) {
                <button type="button" class="btn btn-primary" (click)="next()">{{ index() + 1 < sentences().length ? tx.next : tx.finish }}</button>
              }
            </div>
          }
        </section>
      } @else if (finished()) {
        @let lang = reading.text.data()?.language ?? language();
        <!-- Resumen final: nota media y, por frase, lo escrito con sus marcas + las correcciones del corrector -->
        <section class="surface space-y-4 p-4" aria-labelledby="dictation-summary">
          <h2 id="dictation-summary" class="title-card">{{ tx.summary }}</h2>
          <p class="text-lg font-bold">{{ i18n.fmt(tx.average, { n: average() }) }}</p>
          <ol class="space-y-3">
            @for (r of results(); track $index) {
              <li class="rounded-xl border border-border bg-card p-3">
                <p class="type-meta"><b>{{ tx.original }}:</b> <span [attr.lang]="lang">{{ r.sentence }}</span> · {{ i18n.fmt(tx.score, { n: r.score }) }}</p>
                <p [attr.lang]="lang">
                  @for (t of r.tokens; track $index) {
                    <span [class]="cls[t.kind]" [title]="tx.kinds[t.kind]">{{ t.text }}</span>
                    @if (t.kind === 'wrong') {
                      <span class="text-tone-success"> ({{ t.expected }})</span>
                    }
                    {{ ' ' }}
                  }
                </p>
                @if (r.correction?.correccion?.errores?.length) {
                  <aula-correction-errors [errors]="r.correction!.correccion.errores" [language]="lang" />
                }
              </li>
            }
          </ol>
          <button type="button" class="btn btn-primary" (click)="restart()"><aula-icon name="refresh" /> {{ tx.restart }}</button>
        </section>
      }
    </aula-card-page>
  `,
})
export default class DictationPage {
  protected readonly i18n = inject(I18nService);
  protected readonly reading = inject(ReadingFacade);
  private readonly speech = inject(SpeechSynthesisService);
  private readonly corrector = inject(OwnLlmRepository);
  protected readonly cls = TOKEN_CLS;

  protected readonly language = signal('en');
  protected readonly level = signal('');
  protected readonly textId = signal('');
  protected readonly index = signal(0);
  protected readonly typed = signal('');
  protected readonly current = signal<DictationResult | null>(null);
  protected readonly checking = signal(false);
  protected readonly results = signal<DictationResult[]>([]);
  protected readonly finished = signal(false);

  protected readonly sentences = computed(() => (this.reading.text.data()?.sentences ?? []).map((s) => s.text).filter((t) => t.trim()));
  protected readonly average = computed(() => {
    const r = this.results();
    return r.length ? Math.round(r.reduce((a, x) => a + x.score, 0) / r.length) : 0;
  });

  constructor() {
    // Filtros → lecturas publicadas de ese idioma y nivel
    // [2026-11-16]: solo los textos creados como «Dictado» en Gestión
    effect(() => void this.reading.loadList({ kind: 'dictation', language: this.language(), level: this.level() || undefined }));
    // Lista cargada → primera lectura (si la elegida ya no está)
    effect(() => {
      const list = this.reading.list.data() ?? [];
      untracked(() => {
        if (list.length && !list.some((r) => r.id === this.textId())) this.textId.set(list[0]!.id);
      });
    });
    // Lectura elegida → sus frases y dictado desde el principio
    effect(() => {
      const id = this.textId();
      if (!id) return;
      untracked(() => {
        this.restart();
        void this.reading.loadText(id);
      });
    });
  }

  protected listen(rate: number): void {
    const s = this.sentences()[this.index()];
    if (s) this.speech.speak(s, this.reading.text.data()?.language ?? this.language(), rate);
  }

  // [check]: comparación al instante + corrector único (Anexo A) en segundo plano · si falla, queda la comparación
  protected async check(): Promise<void> {
    const sentence = this.sentences()[this.index()];
    const typed = this.typed().trim();
    if (!sentence || !typed || this.current()) return;
    const tokens = diffWords(sentence, typed);
    this.current.set({ sentence, typed, tokens, score: dictationScore(tokens), correction: null });
    this.checking.set(true);
    try {
      const d = this.reading.text.data();
      const correction = await firstValueFrom(
        this.corrector.correctSentence({ texto: typed, idioma: d?.language ?? this.language(), nivel: d?.level ?? 'A1', tipo_de_texto: 'frase', origen: 'escrito' }),
      );
      this.current.update((c) => (c ? { ...c, correction } : c));
    } catch {
      // Sin corrector (servicio de IA apagado): el alumno ve igualmente la comparación con la frase dictada
    } finally {
      this.checking.set(false);
    }
  }

  protected next(): void {
    const c = this.current();
    if (c) this.results.update((r) => [...r, c]);
    this.current.set(null);
    this.typed.set('');
    if (this.index() + 1 >= this.sentences().length) this.finished.set(true);
    else this.index.update((i) => i + 1);
  }

  protected restart(): void {
    this.speech.stop();
    this.index.set(0);
    this.typed.set('');
    this.current.set(null);
    this.results.set([]);
    this.finished.set(false);
  }
}
