import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
import type { TranscriptLine } from '@shared/ui/organisms/synced-transcript/transcript-line.model';
// [TranscriptLineComponent · Molécula · Sprint 9.7 · RF-117/RF-119/RF-123]: una línea con su IPA y su traducción; la actual con aria-current, negrita y subrayado (no solo color) | [Patrón]: Atomic Design (molécula) + Presentational Component | [Principio]: SRP | [Paradigma]: Declarativo
// [A11y/i18n]: cada fragmento lleva su `lang` (zh-Hans, ru…) y el IPA la variante `-fonipa` → los lectores de pantalla no leen el IPA como texto del idioma · área táctil completa para saltar a la línea

const LANG_TAG: Readonly<Record<string, string>> = { zh: 'zh-Hans' }; // El resto: el código ISO 639-1 sirve como etiqueta BCP 47

@Component({
  selector: 'aula-transcript-line',
  imports: [IconComponent, PronunciationButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="grid gap-x-6 gap-y-1 rounded-xl px-3 py-2 transition-colors"
      [class]="cols()"
      [class.bg-tone-brand-soft]="current()"
      [attr.aria-current]="current() ? 'true' : null"
    >
      <div class="flex min-w-0 items-start gap-2">
        <!-- [Audio por línea · 2026-10-19]: cada turno/verso suena con el audio del servidor (nube + copia local); antes solo había voz si el diálogo tenía un audio subido -->
        <aula-pronunciation-button class="scale-90" [text]="line().text" [language]="language()" [label]="listenLabel()" />
        <div class="min-w-0">
        @if (line().speaker) {
          <span class="mr-1 text-xs font-bold uppercase tracking-wide text-tone-brand"
            >{{ line().speaker }}:</span
          >
        }
        <button
          type="button"
          class="text-left text-base leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
          [class.font-bold]="current()"
          [class.underline]="current()"
          [class.decoration-2]="current()"
          [class.underline-offset-4]="current()"
          [attr.lang]="tag()"
          [disabled]="!seekable()"
          (click)="seek.emit()"
        >
          <!-- [Karaoke · 2026-10-23]: con avance conocido, las palabras ya cantadas se pintan con el degradado de marca (el marcador «corre» por la letra) -->
          @if (sung() !== null) {
            @for (w of words(); track $index) {
              <span class="rounded transition-colors duration-200" [class]="$index < sung()! ? 'bg-gradient-brand text-white' : ''">{{ w }}</span>{{ ' ' }}
            }
          } @else {
            {{ line().text }}
          }
        </button>
        @if (ipa()) {
          <p class="font-mono text-xs text-muted-foreground" [attr.lang]="tag() + '-fonipa'">
            /{{ ipa() }}/
          </p>
        }
        </div>
      </div>
      @if (showTranslation()) {
        <p class="text-sm text-muted-foreground md:text-base" lang="es">
          {{ line().translation || '—' }}
        </p>
      }
      @if (line().note) {
        <p
          class="col-span-full rounded-lg bg-tone-warning-soft px-2 py-1 text-xs text-tone-warning"
          lang="es"
        >
          <aula-icon name="lightbulb" /> {{ line().note }}
        </p>
      }
    </div>
  `,
})
export class TranscriptLineComponent {
  readonly line = input.required<TranscriptLine>();
  readonly language = input('en');
  readonly accent = input<'uk' | 'us'>('uk');
  readonly current = input(false);
  readonly progress = input<number | null>(null); // Avance 0–1 dentro de esta línea (solo la que suena)
  readonly showTranslation = input(true);
  readonly seekable = input(false);
  readonly listenLabel = input('Escuchar'); // Nombre accesible del botón de audio (i18n del contenedor)
  readonly seek = output<void>();
  protected readonly tag = computed(() => LANG_TAG[this.language()] ?? this.language());
  // [IPA]: en inglés el del acento elegido; si falta el US se muestra el UK
  protected readonly ipa = computed(() =>
    this.language() === 'en' && this.accent() === 'us'
      ? this.line().ipaUs || this.line().ipa
      : this.line().ipa,
  );
  // [words/sung]: palabras de la línea y cuántas ya sonaron (reparto uniforme del tiempo del verso) | `Math.ceil`: la palabra en curso ya se marca
  protected readonly words = computed(() => this.line().text.split(/\s+/).filter(Boolean));
  protected readonly sung = computed(() => {
    const p = this.progress();
    return p === null ? null : Math.ceil(p * this.words().length);
  });
  // [Responsive]: dos columnas desde md; en móvil la traducción va debajo del original
  protected readonly cols = computed(() => (this.showTranslation() ? 'md:grid-cols-2' : ''));
}
