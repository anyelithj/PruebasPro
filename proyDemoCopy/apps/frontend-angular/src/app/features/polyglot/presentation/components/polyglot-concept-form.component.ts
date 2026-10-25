import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DEFAULT_ORDER } from '../../domain/language-order';
import { ConceptInputSchema, type ConceptInput, type TermInput } from '../../domain/models/polyglot';
// [PolyglotConceptFormComponent · Presentacional · Sprint 10.8 · RF-130/RF-132]: alta de un concepto — emoji o imagen (con licencia obligatoria), significado en español, tipo y un término por idioma; el IPA lo calcula el servidor al guardar | [Patrón]: Presentational Component + Schema Validation (Zod) | [Principio]: SRP + cumplimiento de derechos de autor + Fail Fast | [Paradigma]: Declarativo + Reactivo (signals)

@Component({
  selector: 'aula-polyglot-concept-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = labels();
    <form class="space-y-3" (submit)="$event.preventDefault(); submit()">
      <div class="grid gap-3 sm:grid-cols-[6rem_1fr_9rem]">
        <label class="text-xs font-semibold">
          {{ tx.emoji }}
          <input class="control mt-1 w-full text-center text-xl" maxlength="16" [value]="emoji()" (input)="emoji.set($any($event.target).value)" />
        </label>
        <label class="text-xs font-semibold">
          {{ tx.gloss }}
          <input class="control mt-1 w-full" maxlength="160" [value]="gloss()" (input)="gloss.set($any($event.target).value)" />
        </label>
        <label class="text-xs font-semibold">
          {{ tx.kind }}
          <select class="control mt-1 w-full" [value]="kind()" (change)="kind.set($any($event.target).value)">
            <option value="word">{{ tx.kinds.word }}</option>
            <option value="phrase">{{ tx.kinds.phrase }}</option>
          </select>
        </label>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="text-xs font-semibold">
          {{ tx.imageUrl }}
          <input class="control mt-1 w-full" type="url" inputmode="url" [value]="imageUrl()" (input)="imageUrl.set($any($event.target).value)" />
        </label>
        <label class="text-xs font-semibold">
          {{ tx.imageLicense }}
          <input
            class="control mt-1 w-full"
            [value]="imageLicense()"
            [attr.aria-invalid]="licenseMissing()"
            [attr.aria-required]="!!imageUrl()"
            (input)="imageLicense.set($any($event.target).value)"
          />
        </label>
      </div>
      <fieldset>
        <legend class="mb-2 text-xs font-semibold">{{ tx.terms }}</legend>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          @for (l of langs; track l) {
            <label class="text-[11px] font-semibold uppercase text-muted-foreground">
              {{ names()[l] ?? l }}
              <input class="control mt-1 w-full normal-case" [attr.lang]="l" maxlength="200" [value]="terms()[l] ?? ''" (input)="setTerm(l, $any($event.target).value)" />
            </label>
          }
        </div>
      </fieldset>
      <button type="submit" class="btn btn-primary" [disabled]="busy() || !valid()">＋ {{ tx.addConcept }}</button>
    </form>
  `,
})
export class PolyglotConceptFormComponent {
  protected readonly langs = DEFAULT_ORDER;
  readonly names = input<Record<string, string>>({});
  readonly busy = input(false);
  readonly labels = input.required<{
    emoji: string;
    gloss: string;
    kind: string;
    kinds: { word: string; phrase: string };
    imageUrl: string;
    imageLicense: string;
    terms: string;
    addConcept: string;
  }>();
  readonly saved = output<{ input: ConceptInput; terms: TermInput[] }>();

  protected readonly emoji = signal('');
  protected readonly gloss = signal('');
  protected readonly kind = signal<'word' | 'phrase'>('word');
  protected readonly imageUrl = signal('');
  protected readonly imageLicense = signal('');
  protected readonly terms = signal<Record<string, string>>({});

  private readonly parsed = computed(() =>
    ConceptInputSchema.safeParse({
      kind: this.kind(),
      emoji: this.emoji(),
      gloss: this.gloss(),
      imageUrl: this.imageUrl(),
      imageLicense: this.imageLicense(),
    }),
  );
  protected readonly licenseMissing = computed(() => !!this.imageUrl().trim() && !this.imageLicense().trim());
  // [valid]: datos válidos y al menos dos idiomas escritos (si no, no hay nada que comparar)
  protected readonly valid = computed(
    () => this.parsed().success && Object.values(this.terms()).filter((t) => t.trim()).length >= 2,
  );

  protected setTerm(lang: string, text: string): void {
    this.terms.update((t) => ({ ...t, [lang]: text }));
  }

  protected submit(): void {
    const p = this.parsed();
    if (!p.success || !this.valid()) return;
    const terms = Object.entries(this.terms())
      .filter(([, t]) => t.trim())
      .map(([language, text]) => ({ language, text: text.trim() }));
    this.saved.emit({ input: p.data, terms });
    this.emoji.set('');
    this.gloss.set('');
    this.imageUrl.set('');
    this.imageLicense.set('');
    this.terms.set({});
  }
}
