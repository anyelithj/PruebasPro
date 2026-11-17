import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { LinePatch, SongLine } from '../../domain/models/music';
import { ModeSwitchComponent } from '@shared/ui/molecules/mode-switch/mode-switch.component';
import { TextImportComponent } from '@shared/ui/molecules/text-import/text-import.component';
import { TextImportService } from '@core/media/text-import.service';
import { LyricsImportService } from '../../infrastructure/lyrics-import.service';
// [LyricsEditorComponent · Presentacional · Sprint 9.9 · RF-117]: pegar la letra y revisar el IPA y la traducción de cada línea (la corrección manual prevalece sobre la automática) | [Patrón]: Presentational Component + Dirty Tracking (solo se envían las líneas cambiadas) | [Principio]: SRP + verificación humana | [Paradigma]: Declarativo + Reactivo
// [2026-11-10]: sin columna «IPA US» (el reproductor usa el IPA principal; el US se calcula solo) · el verso es editable
// [A11y]: tabla con encabezados y campos con etiqueta oculta por línea · scroll horizontal solo dentro de la tabla en móvil

export interface LyricsLabels {
  lyrics: string;
  loadLyrics: string;
  loadLyricsManual: string;
  manualTranslation: string; // [2026-11-06]: traducción escrita a mano en modo manual
  manualIpa: string; // [2026-11-06]: IPA escrito a mano en modo manual
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
  // [2026-10-24 · DI jerárquica]: <aula-text-import> de ESTE editor lee los enlaces con el extractor de letras de NestJS (el resto del portal sigue con el general)
  providers: [{ provide: TextImportService, useClass: LyricsImportService }],
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
        (imported)="$event.text && draft.set($event.text)"
      />
      <!-- [2026-11-06]: área más alta (antes min-h-40 → se veían pocos versos) · modo manual: traducción al lado, verso a verso (en móvil, debajo) -->
      <!-- [2026-11-06 · Manual]: letra · IPA · traducción, una línea por verso (sin IA: nada se rellena solo) -->
      <div class="grid gap-3" [class]="manualMode() ? (manualTx() ? 'lg:grid-cols-3' : 'md:grid-cols-2') : ''">
        <label class="block text-xs font-semibold text-muted-foreground">
          {{ lb.lyrics }} <span class="req" aria-hidden="true">*</span>
          <textarea
            class="control mt-1 min-h-80 w-full resize-y font-mono text-sm leading-6"
            rows="16"
            required
            [attr.lang]="language()"
            maxlength="12000"
            [value]="draft()"
            (input)="draft.set($any($event.target).value)"
          ></textarea>
        </label>
        @if (manualMode()) {
          <label class="block text-xs font-semibold text-muted-foreground">
            {{ lb.manualIpa }}
            <textarea
              class="control mt-1 min-h-80 w-full resize-y font-mono text-sm leading-6"
              rows="16"
              lang="und-fonipa"
              maxlength="12000"
              [value]="ipaDraft()"
              (input)="ipaDraft.set($any($event.target).value)"
            ></textarea>
          </label>
        }
        @if (manualTx()) {
          <label class="block text-xs font-semibold text-muted-foreground">
            {{ lb.manualTranslation }}
            <textarea
              class="control mt-1 min-h-80 w-full resize-y font-mono text-sm leading-6"
              rows="16"
              lang="es"
              maxlength="12000"
              [value]="translationDraft()"
              (input)="translationDraft.set($any($event.target).value)"
            ></textarea>
          </label>
        }
      </div>
      <button
        type="button"
        class="btn btn-primary"
        [disabled]="!draft().trim() || busy()"
        (click)="loadLyrics.emit({ lyrics: draft(), auto: mode() === 'auto', translations: manualTx() ? translationDraft() : '', ipas: manualMode() ? ipaDraft() : '' })"
      >
        <aula-icon [name]="mode() === 'auto' ? 'sparkles' : 'pen-line'" /> {{ mode() === 'auto' ? lb.loadLyrics : lb.loadLyricsManual }}
      </button>

      @if (lines().length) {
        @if (nativeReview()) {
          <p class="rounded-lg bg-tone-warning-soft p-2 type-meta font-semibold text-tone-warning">
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
                  <td class="p-1">
                    <!-- [2026-11-10]: el verso también se corrige aquí (antes solo IPA y traducción) -->
                    <input
                      class="control w-full text-xs"
                      [attr.lang]="language()"
                      maxlength="500"
                      [attr.aria-label]="lb.text + ' ' + (l.position + 1)"
                      [value]="l.text"
                      (input)="edit(l.id, 'text', $any($event.target).value)"
                    />
                  </td>
                  <td class="p-1">
                    <input
                      class="control w-full font-mono text-xs"
                      [attr.aria-label]="lb.ipa + ' ' + (l.position + 1)"
                      [value]="l.ipa"
                      (input)="edit(l.id, 'ipa', $any($event.target).value)"
                    />
                  </td>
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
        <!-- [2026-11-13]: «Guardar» sin icono, a la derecha y con el mismo aspecto que el resto (btn-primary) -->
        <div class="flex justify-end">
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="!dirty() || busy()"
            (click)="save.emit(patches())"
          >
            {{ lb.saveLines }}
          </button>
        </div>
      }
    </div>
  `,
})
export class LyricsEditorComponent {
  readonly lines = input<readonly SongLine[]>([]);
  readonly language = input('en');
  readonly busy = input(false);
  readonly labels = input.required<LyricsLabels>();
  readonly initial = input(''); // [2026-10-24]: letra propuesta (p. ej. la generada con IA) mientras aún no hay líneas guardadas
  readonly loadLyrics = output<{ lyrics: string; auto: boolean; translations: string; ipas: string }>();
  protected readonly mode = signal<string>('auto');
  protected readonly translationDraft = signal(''); // [2026-11-06]: una línea por verso (mismo orden que la letra)
  protected readonly ipaDraft = signal('');
  protected readonly manualMode = computed(() => this.mode() === 'manual');
  protected readonly manualTx = computed(() => this.manualMode() && this.language() !== 'es');
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
    // [initial]: rellena el área vacía o la que solo muestra la letra ya guardada (nunca pisa cambios sin guardar del docente) | `untracked`: no depende de `draft` ni de `lines`
    // [2026-10-24]: «Importar la letra desde este enlace» (paso del audio) también llega por aquí aunque la canción ya tenga versos
    effect(() => {
      const text = this.initial();
      const current = untracked(this.draft).trim();
      const saved = untracked(this.lines).map((l) => l.text).join('\n').trim();
      if (text && (!current || current === saved)) this.draft.set(text);
    });
  }

  // [pendingLoad · 2026-11-10 · «Falta la letra» al publicar]: letra escrita/importada en el área pero SIN cargar → lo que emitiría «Cargar letra» (null = nada pendiente)
  pendingLoad(): { lyrics: string; auto: boolean; translations: string; ipas: string } | null {
    const text = this.draft().trim();
    if (!text || text === this.lines().map((l) => l.text).join('\n').trim()) return null;
    return { lyrics: this.draft(), auto: this.mode() === 'auto', translations: this.manualTx() ? this.translationDraft() : '', ipas: this.manualMode() ? this.ipaDraft() : '' };
  }

  protected edit(id: string, field: 'text' | 'ipa' | 'translation', value: string): void {
    this.changes.update((c) => ({ ...c, [id]: { ...c[id], id, [field]: value } }));
  }
}
