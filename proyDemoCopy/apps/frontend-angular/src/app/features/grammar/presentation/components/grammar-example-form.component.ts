import { ChangeDetectionStrategy, Component, effect, input, output, signal, untracked } from '@angular/core';
import type { Example, ExamplePatch } from '../../domain/models/grammar';
// [GrammarExampleFormComponent · Presentacional · Sprint 10.12 · RF-134/RF-135]: agregar un ejemplo (el servidor calcula IPA y traducción) o corregir uno existente con vista previa de IPA (UK y US en inglés) y traducción — la corrección manual prevalece | [Patrón]: Presentational Component | [Principio]: SRP + verificación humana | [Paradigma]: Declarativo + Reactivo (signals)

@Component({
  selector: 'aula-grammar-example-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = labels();
    <form class="grid gap-2" [class.sm:grid-cols-2]="!!example()" (submit)="$event.preventDefault(); submit()">
      <label class="text-xs font-semibold" [class.sm:col-span-2]="!!example()">
        {{ tx.exampleText }}
        <input class="control mt-1 w-full" [attr.lang]="language()" maxlength="600" [value]="text()" (input)="text.set($any($event.target).value)" />
      </label>
      @if (example()) {
        <label class="text-xs font-semibold">
          {{ tx.ipa }}
          <input class="control mt-1 w-full font-mono" [value]="ipa()" (input)="ipa.set($any($event.target).value)" />
        </label>
        @if (language() === 'en') {
          <label class="text-xs font-semibold">
            {{ tx.ipaUs }}
            <input class="control mt-1 w-full font-mono" [value]="ipaUs()" (input)="ipaUs.set($any($event.target).value)" />
          </label>
        }
        <label class="text-xs font-semibold sm:col-span-2">
          {{ tx.translation }}
          <input class="control mt-1 w-full" lang="es" [value]="translation()" (input)="translation.set($any($event.target).value)" />
        </label>
      }
      <div class="flex flex-wrap gap-2" [class.sm:col-span-2]="!!example()">
        <button type="submit" class="btn btn-primary btn-sm" [disabled]="busy() || !text().trim()">{{ example() ? tx.save : '＋ ' + tx.addExample }}</button>
        @if (example()) {
          <button type="button" class="btn btn-ghost btn-sm text-tone-danger" [disabled]="busy()" (click)="removed.emit()">{{ tx.remove }}</button>
        }
      </div>
    </form>
  `,
})
export class GrammarExampleFormComponent {
  readonly example = input<Example | null>(null); // null = alta (solo texto)
  readonly language = input('en');
  readonly busy = input(false);
  readonly labels = input.required<{ exampleText: string; ipa: string; ipaUs: string; translation: string; save: string; addExample: string; remove: string }>();
  readonly added = output<string>();
  readonly saved = output<ExamplePatch>();
  readonly removed = output<void>();

  protected readonly text = signal('');
  protected readonly ipa = signal('');
  protected readonly ipaUs = signal('');
  protected readonly translation = signal('');

  constructor() {
    effect(() => {
      const e = this.example();
      untracked(() => {
        this.text.set(e?.text ?? '');
        this.ipa.set(e?.ipa ?? '');
        this.ipaUs.set(e?.ipaUs ?? '');
        this.translation.set(e?.translation ?? '');
      });
    });
  }

  // [submit]: en edición solo se envía lo que cambió (un IPA tocado marca el ejemplo como revisado en NestJS)
  protected submit(): void {
    const e = this.example();
    if (!e) {
      this.added.emit(this.text().trim());
      this.text.set('');
      return;
    }
    const patch: ExamplePatch = {};
    if (this.text().trim() !== e.text) patch.text = this.text().trim();
    if (this.ipa().trim() !== e.ipa) patch.ipa = this.ipa().trim();
    if (this.language() === 'en' && this.ipaUs().trim() !== (e.ipaUs ?? '')) patch.ipaUs = this.ipaUs().trim();
    if (this.translation().trim() !== (e.translation ?? '')) patch.translation = this.translation().trim();
    if (Object.keys(patch).length) this.saved.emit(patch);
  }
}
