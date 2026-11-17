import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { DictionaryFacade } from '@core/dictionary/dictionary.facade';
import { DictionaryRepository } from '@core/dictionary/dictionary.repository.port';
import { I18nService } from '@core/i18n/i18n.service';
import { PronunciationButtonComponent } from '../pronunciation-button/pronunciation-button.component';
// [TitleGloss · Molécula · 2026-11-06]: bajo el título de una actividad o recurso → idioma · /IPA/ · 🔊 · traducción al español
// IPA al instante (espeak, sin IA) y la traducción después (caché del diccionario) | sin servicio → solo el idioma (Fail Soft)
// [A11y]: IPA con lang="und-fonipa" (no se lee como texto) y data-ipa (el diccionario no se abre sobre él) · traducción con lang="es"

// [looksSpanish]: título escrito en español (interfaz) aunque la actividad sea de otro idioma → sin glosa (el IPA saldría inventado)
const ES_WORDS = new Set(['el', 'los', 'las', 'del', 'y', 'con', 'una', 'práctica', 'lectura', 'diálogo', 'canción', 'juego']); // Solo palabras que NO son también inglesas/francesas/portuguesas/alemanas
export function looksSpanish(text: string, language: string): boolean {
  if (language === 'es') return false;
  if (/[ñ¿¡]/i.test(text) || (language !== 'fr' && language !== 'pt' && /[áéíóú]/i.test(text))) return true;
  const w = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  return w.some((x) => ES_WORDS.has(x));
}

@Component({
  selector: 'aula-title-gloss',
  imports: [PronunciationButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block text-sm' },
  // [2026-11-09 · Presentación]: UNA fila = 🔊 /IPA/ · «traducción» (antes idioma, IPA y traducción se partían en líneas sueltas; el idioma ya sale en el subtítulo)
  template: `
    @if (suffix()) {
      <!-- [2026-11-10 · Canciones]: dos líneas → 🔊 /IPA/ · «traducción · sufijo» -->
      @if (!looksSpanish(text(), language())) {
        <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <aula-pronunciation-button [text]="text()" [language]="language()" [label]="i18n.t().common.listen + ': ' + text()" />
          @if (ipa()) {
            <span class="font-mono text-muted-foreground" lang="und-fonipa" data-ipa>/{{ ipa() }}/</span>
          }
        </span>
      }
      <span class="mt-1 block text-muted-foreground">
        @if (translation() && !looksSpanish(text(), language())) {
          <span lang="es"><span class="sr-only">Traducción: </span>{{ translation() }}</span> ·
        }
        {{ suffix() }}
      </span>
    } @else if (!looksSpanish(text(), language())) {
      <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <aula-pronunciation-button [text]="text()" [language]="language()" [label]="i18n.t().common.listen + ': ' + text()" />
        @if (ipa()) {
          <span class="font-mono text-muted-foreground" lang="und-fonipa" data-ipa>/{{ ipa() }}/</span>
        }
        @if (translation()) {
          <span class="text-muted-foreground" aria-hidden="true">·</span>
          <span lang="es"><span class="sr-only">Traducción: </span>«{{ translation() }}»</span>
        }
      </span>
    }
  `,
})
export class TitleGlossComponent {
  protected readonly i18n = inject(I18nService);
  // Sin repositorio del diccionario (pruebas, apps sin él) → solo el idioma y el 🔊 (Fail Soft)
  private readonly dict = inject(DictionaryRepository, { optional: true }) ? inject(DictionaryFacade) : null;
  readonly text = input.required<string>();
  readonly language = input.required<string>();
  readonly ipaHint = input(''); // [2026-11-10]: IPA/traducción ya guardados → se muestran sin consultar el servicio
  readonly translationHint = input('');
  readonly suffix = input(''); // [2026-11-10]: texto tras la traducción («Inglés · A1») → formato de dos líneas
  protected readonly looksSpanish = looksSpanish;
  protected readonly ipa = signal<string | null>(null);
  protected readonly translation = signal('');

  constructor() {
    effect(() => {
      const [text, language] = [this.text().trim().slice(0, 60), this.language()];
      const key = `gloss|${language}|${text}`;
      // [2026-11-09 · «el título tarda en cargar»]: glosa ya vista → al instante desde localStorage (la IA solo se consulta la primera vez)
      const saved = this.ipaHint() ? { ipa: this.ipaHint().replace(/^\/|\/$/g, ''), translation: this.translationHint() } : null;
      const hit = saved ?? readGloss(key);
      this.ipa.set(hit?.ipa ?? null);
      this.translation.set(hit?.translation ?? '');
      if (!text || !this.dict || looksSpanish(text, language) || (hit?.ipa && (hit.translation || language === 'es'))) return;
      const dict = this.dict;
      const same = (): boolean => this.text().trim().slice(0, 60) === text;
      const save = (): void => writeGloss(key, { ipa: this.ipa(), translation: this.translation() });
      // [Fix 2026-11-09]: espeak deja guiones de enlace («lə-») → fuera
      void dict.ipa(language, text).then((r) => {
        if (!r || !same()) return;
        this.ipa.set((r.ipa ?? r.ipa_us ?? '').replace(/^\/|\/$/g, '').replace(/-(?=\s|$)/g, '') || null);
        save();
      });
      if (language === 'es') return;
      // [Fix 2026-11-09 · traducción incompleta]: título de varias palabras → traducción de la frase entera; una palabra → diccionario
      const multi = /\s/.test(text);
      void (multi ? dict.translate(language, text) : dict.lookup(language, text).then((r) => r?.result.translation ?? '')).then((t) => {
        if (!t || !same()) return;
        this.translation.set(t);
        save();
      });
    });
  }
}

// [Caché local]: try/catch → modo privado o almacenamiento bloqueado = sin caché (se vuelve a pedir)
type Gloss = { ipa: string | null; translation: string };
function readGloss(key: string): Gloss | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as Gloss | null;
  } catch {
    return null;
  }
}
function writeGloss(key: string, g: Gloss): void {
  try {
    localStorage.setItem(key, JSON.stringify(g));
  } catch {
    /* sin almacenamiento */
  }
}
