import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
import { markWhy, RIGHT_CLS, WRONG_CLS, type TranscriptLine } from '@shared/ui/organisms/synced-transcript/transcript-line.model';
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
              <span class="rounded transition-colors duration-200" [class]="$index < sung()! ? 'bg-primary text-white' : ''">{{ w }}</span>{{ ' ' }}
            }
          } @else {
            {{ line().text }}
          }
        </button>
        @if (ipa()) {
          <p class="font-mono type-meta text-muted-foreground" [attr.lang]="tag() + '-fonipa'">
            /{{ ipa() }}/
          </p>
        }
        </div>
      </div>
      @if (showTranslation()) {
        <p class="text-muted-foreground" lang="es">
          {{ line().translation || '—' }}
        </p>
      }
      @if (line().noteFix || line().note) {
        <!-- [2026-11-09]: corrección con colores → rojo tachado = lo que dijiste mal · verde = lo correcto · debajo, el porqué -->
        <div class="col-span-full space-y-0.5 rounded-lg bg-tone-warning-soft px-2 py-1 type-meta">
          @if (line().noteFix; as fix) {
            <p [attr.lang]="tag()">
              <span class="font-semibold text-foreground" lang="es">{{ line().noteLabel }} </span>
              @for (w of diff(line().text, fix); track $index) {
                <span [class]="w.cls">{{ w.text }}</span>{{ ' ' }}
              }
            </p>
          }
          @if (line().note) {
            <p class="text-foreground" lang="es"><aula-icon name="lightbulb" /> @for (p of markWhy(line().note!); track $index) {<span [class]="p.cls">{{ p.text }}</span>}</p>
          }
        </div>
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
  protected readonly markWhy = markWhy;
  protected readonly tag = computed(() => LANG_TAG[this.language()] ?? this.language());
  // [IPA]: en inglés el del acento elegido; si falta el US se muestra el UK
  // [2026-11-09]: letras ya guardadas con guiones de enlace de espeak («mə-») → fuera al mostrar
  protected readonly ipa = computed(() =>
    ((this.language() === 'en' && this.accent() === 'us' ? this.line().ipaUs || this.line().ipa : this.line().ipa) ?? '').replace(/-(?=\s|$)/g, ''),
  );
  // [words/sung]: palabras de la línea y cuántas ya sonaron (reparto uniforme del tiempo del verso) | `Math.ceil`: la palabra en curso ya se marca
  protected readonly words = computed(() => this.line().text.split(/\s+/).filter(Boolean));
  protected readonly sung = computed(() => {
    const p = this.progress();
    if (p === null) return null;
    if (p <= 0) return 0;
    // [2026-11-10 · «a la sincronía le falta un poco»]: el tiempo se reparte por letras (una palabra larga dura más que «a»), no igual por palabra
    const w = this.words();
    const total = w.reduce((n, x) => n + x.length + 1, 0);
    let acc = 0;
    const k = w.findIndex((x) => (acc += x.length + 1) / total >= p);
    return p >= 1 ? w.length : k + 1;
  });
  // [Responsive]: dos columnas desde md; en móvil la traducción va debajo del original
  protected readonly cols = computed(() => (this.showTranslation() ? 'md:grid-cols-2' : ''));

  // [diff · 2026-11-09]: palabras tuyas que sobran (rojo tachado) seguidas de la frase corregida con lo nuevo en verde | comparación sin mayúsculas ni puntuación
  protected diff(said: string, fix: string): { text: string; cls: string }[] {
    const key = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
    const mine = said.split(/\s+/).filter(Boolean);
    const good = fix.split(/\s+/).filter(Boolean);
    const goodKeys = new Set(good.map(key));
    const mineKeys = new Set(mine.map(key));
    const wrong = mine.filter((w) => !goodKeys.has(key(w))).map((w) => ({ text: w, cls: WRONG_CLS }));
    const out = good.map((w) => ({ text: w, cls: mineKeys.has(key(w)) ? 'text-foreground' : RIGHT_CLS }));
    const at = out.findIndex((w) => !mineKeys.has(key(w.text))); // Lo tachado va justo antes de la primera palabra nueva («I ~~had~~ have»)
    out.splice(at < 0 ? out.length : at, 0, ...wrong);
    return out;
  }
}
