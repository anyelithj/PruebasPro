import { ChangeDetectionStrategy, Component, effect, ElementRef, signal, viewChild } from '@angular/core';
import { placeWordCard, WordCardComponent, type WordCardPlace } from './word-card.component';
// [WordDictionaryComponent · Organismo · 2026-10-30]: el pequeño diccionario en TODAS las pantallas Angular → seleccionar (doble clic) UNA palabra en otro idioma abre su ficha junto a ella
// El idioma sale del atributo HTML `lang` más cercano | Espejo de <WordDictionary> de Next.js | [Patrón]: Event Delegation + Reuse (WordCard) | [Principio]: DRY + OCP | [Paradigma]: Reactivo (signals)
// [A11y]: Esc y clic fuera cierran; `popover` (HTML nativo) en la capa superior → sin recortes por `overflow` ni `transform`

const MAX_WORD = 60; // = @MaxLength de LookupWordDto
// [Excluidos]: campos de edición y zonas con diccionario propio (lector, <aula-word-lookup>)
const IGNORE = 'input, textarea, select, [contenteditable], [data-word-card], [data-reading-word], [data-word], a, button, rt, [lang|="und"], [data-ipa]';
// [2026-11-06 · Sin diccionario sobre el IPA]: «/ˈhʊnt/» no es una palabra del idioma → símbolos fonéticos o entre barras = no se busca
const IPA = /[ˈˌːəɐɛɪʊʌɔæɑɒʃʒθðŋɹɾʁχçʏøœɲʎʔ]|^\/.*\/$/u;

@Component({
  selector: 'aula-word-dictionary',
  imports: [WordCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onClick($event)', '(document:keydown.escape)': 'card.set(null)' },
  template: `
    @if (card(); as c) {
      <div #box popover="manual" data-word-card class="fixed m-0 overflow-visible border-0 bg-transparent p-0" [style.left.px]="c.left" [style.top]="c.top" [style.right]="'auto'" [style.bottom]="c.bottom">
        <aula-word-card [word]="c.word" [language]="c.language" [sentence]="c.sentence" [arrow]="c.arrow" [above]="c.above" (closed)="card.set(null)" />
      </div>
    }
  `,
})
export class WordDictionaryComponent {
  protected readonly card = signal<(WordCardPlace & { word: string; language: string; sentence: string }) | null>(null);
  private readonly box = viewChild<ElementRef<HTMLElement>>('box');

  constructor() {
    effect(() => this.box()?.nativeElement.showPopover?.()); // `?.()`: navegador sin Popover API → queda como `position: fixed`
  }

  // [onClick]: `click` llega tras soltar → la selección ya está hecha | público para el `host`
  onClick(e: MouseEvent): void {
    if ((e.target as Element).closest?.('[data-word-card]')) return; // Dentro de la ficha: no se toca
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';
    const host = selection?.rangeCount ? selection.getRangeAt(0).startContainer.parentElement : null;
    const lang = host?.closest<HTMLElement>('[lang]');
    const language = lang && lang !== document.documentElement ? lang.lang.toLowerCase().split('-')[0] : '';
    const word = text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').slice(0, MAX_WORD);
    if (!word || /\s/.test(text) || !language || language === 'es' || host?.closest(IGNORE) || IPA.test(text) || /^[/[].*[/\]]$/.test(host?.textContent?.trim() ?? '')) return this.card.set(null);
    this.card.set({
      word,
      language,
      sentence: (host?.closest('li, p, td, h1, h2, h3, h4')?.textContent ?? '').trim().slice(0, 400),
      ...placeWordCard(selection!.getRangeAt(0).getBoundingClientRect()),
    });
  }
}
