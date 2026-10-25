import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import type { LinePatch, SongLine } from '../../domain/models/music';
import { ModeSwitchComponent } from '@shared/ui/molecules/mode-switch/mode-switch.component';
import { TextImportComponent } from '@shared/ui/molecules/text-import/text-import.component';
// [LyricsEditorComponent · Presentacional · Sprint 9.9 · RF-117]: pegar la letra y revisar el IPA y la traducción de cada línea (la corrección manual prevalece sobre la automática) | [Patrón]: Presentational Component + Dirty Tracking (solo se envían las líneas cambiadas) | [Principio]: SRP + verificación humana | [Paradigma]: Declarativo + Reactivo
// [A11y]: tabla con encabezados y campos con etiqueta oculta por línea · scroll horizontal solo dentro de la tabla en móvil

export interface LyricsLabels {
  lyrics: string;
  loadLyrics: string;
  loadLyricsManual: string;
  mode: string;
  modeAuto: string;
  modeAutoHint: string;
  modeManual: string;
  modeManualHint: string;
  text: string;
  ipa: string;
  ipaUs: string;
  translation: string;
  saveLines: string;
  nativeReview: string;
  importFile: string; // [2026-10-23]: importar la letra desde archivo o enlace
  importUrl: string;
  importRead: string;
  importReading: string;
}

@Component({
  selector: 'aula-lyrics-editor',
  imports: [IconComponent, ModeSwitchComponent, TextImportComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let lb = labels();
    <div class="space-y-3">
      <!-- [Modo · 2026-10-19]: IPA y traducción automáticas (espeak-ng + IA) o escritas a mano en la tabla -->
      <aula-mode-switch
        name="lyrics-mode"
        [legend]="lb.mode"
        [options]="[
          { value: 'auto', label: lb.modeAuto, hint: lb.modeAutoHint },
          { value: 'manual', label: lb.modeManual, hint: lb.modeManualHint },
        ]"
        [(value)]="mode"
      />
      <!-- [2026-10-23]: la letra también llega de un PDF, un Word, una imagen (OCR) o un enlace → rellena el área de texto para revisarla -->
      <aula-text-import
        [language]="language()"
        [labels]="{ file: lb.importFile, url: lb.importUrl, read: lb.importRead, reading: lb.importReading }"
        (imported)="draft.set($event.text)"
      />
      <label class="block text-xs font-semibold text-muted-foreground">
        {{ lb.lyrics }} <span class="req" aria-hidden="true">*</span>
        <textarea
          class="control mt-1 min-h-40 w-full font-mono text-sm"
          required
          [attr.lang]="language()"
          maxlength="12000"
          [value]="draft()"
          (input)="draft.set($any($event.target).value)"
        ></textarea>
      </label>
      <button
        type="button"
        class="btn btn-primary"
        [disabled]="!draft().trim() || busy()"
        (click)="loadLyrics.emit({ lyrics: draft(), auto: mode() === 'auto' })"
      >
        <aula-icon [name]="mode() === 'auto' ? 'sparkles' : 'pen-line'" /> {{ mode() === 'auto' ? lb.loadLyrics : lb.loadLyricsManual }}
      </button>

      @if (lines().length) {
        @if (nativeReview()) {
          <p class="rounded-lg bg-tone-warning-soft p-2 text-xs font-semibold text-tone-warning">
            <aula-icon name="triangle-alert" /> {{ lb.nativeReview }}
          </p>
        }
        <div class="overflow-x-auto rounded-xl border border-border">
          <table class="w-full min-w-[40rem] text-sm">
            <thead class="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th class="p-2">#</th>
                <th class="p-2">{{ lb.text }}</th>
                <th class="p-2">{{ lb.ipa }}</th>
                @if (language() === 'en') {
                  <th class="p-2">{{ lb.ipaUs }}</th>
                }
                @if (language() !== 'es') {
                  <th class="p-2">{{ lb.translation }}</th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              @for (l of lines(); track l.id) {
                <tr [class.bg-tone-brand-soft]="!!changes()[l.id]">
                  <td class="p-2 text-xs tabular-nums text-muted-foreground">
                    {{ l.position + 1 }}
                  </td>
                  <td class="p-2" [attr.lang]="language()">{{ l.text }}</td>
                  <td class="p-1">
                    <input
                      class="control w-full font-mono text-xs"
                      [attr.aria-label]="lb.ipa + ' ' + (l.position + 1)"
                      [value]="l.ipa"
                      (input)="edit(l.id, 'ipa', $any($event.target).value)"
                    />
                  </td>
                  @if (language() === 'en') {
                    <td class="p-1">
                      <input
                        class="control w-full font-mono text-xs"
                        [attr.aria-label]="lb.ipaUs + ' ' + (l.position + 1)"
                        [value]="l.ipaUs ?? ''"
                        (input)="edit(l.id, 'ipaUs', $any($event.target).value)"
                      />
                    </td>
                  }
                  @if (language() !== 'es') {
                    <td class="p-1">
                      <input
                        class="control w-full text-xs"
                        lang="es"
                        [attr.aria-label]="lb.translation + ' ' + (l.position + 1)"
                        [value]="l.translation ?? ''"
                        (input)="edit(l.id, 'translation', $any($event.target).value)"
                      />
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <button
          type="button"
          class="btn btn-outline"
          [disabled]="!dirty() || busy()"
          (click)="save.emit(patches())"
        >
          <aula-icon name="save" /> {{ lb.saveLines }}
        </button>
      }
    </div>
  `,
})
export class LyricsEditorComponent {
  readonly lines = input<readonly SongLine[]>([]);
  readonly language = input('en');
  readonly busy = input(false);
  readonly labels = input.required<LyricsLabels>();
  readonly loadLyrics = output<{ lyrics: string; auto: boolean }>();
  protected readonly mode = signal<string>('auto');
  readonly save = output<LinePatch[]>();
  protected readonly draft = signal('');
  protected readonly changes = signal<Record<string, LinePatch>>({});
  protected readonly dirty = computed(() => Object.keys(this.changes()).length > 0);
  protected readonly nativeReview = computed(() => this.lines().some((l) => l.needsNativeReview));
  protected readonly patches = computed(() => Object.values(this.changes()));

  constructor() {
    // Al (re)cargar las líneas: el borrador muestra la letra guardada y se olvidan los cambios ya enviados
    effect(() => {
      const ls = this.lines();
      if (ls.length) this.draft.set(ls.map((l) => l.text).join('\n'));
      this.changes.set({});
    });
  }

  protected edit(id: string, field: 'ipa' | 'ipaUs' | 'translation', value: string): void {
    this.changes.update((c) => ({ ...c, [id]: { ...c[id], id, [field]: value } }));
  }
}
