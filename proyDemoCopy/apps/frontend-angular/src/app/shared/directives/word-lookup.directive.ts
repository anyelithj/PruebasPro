import { Directive, ElementRef, inject } from '@angular/core';
// [WordLookupDirective · shared/directives · Sprint 10.3 · RF-136]: convierte un texto de palabras pulsables en UNA sola parada de tabulación — las flechas, Inicio y Fin mueven entre palabras (roving tabindex) y Enter o Espacio abren el diccionario (botones nativos) | [Patrón]: Directive (comportamiento reutilizable sin plantilla) | [Principio]: DRY + accesibilidad (WCAG 2.1.1 teclado, 2.4.3 orden del foco) | [Paradigma]: Declarativo
// [Uso]: <span aulaWordLookup> con botones `[data-word]` dentro (los pinta WordLookupComponent con Intl.Segmenter); sirve para cualquier texto de cualquier funcionalidad

@Directive({
  selector: '[aulaWordLookup]',
  host: {
    '(keydown)': 'onKey($event)',
    '(focusin)': 'onFocus($event)',
  },
})
export class WordLookupDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private words(): HTMLElement[] {
    return [...this.host.nativeElement.querySelectorAll<HTMLElement>('[data-word]')];
  }

  // [onFocus]: la palabra enfocada pasa a ser la única con tabindex=0 → al volver con Tab se regresa a ella
  protected onFocus(e: FocusEvent): void {
    const target = e.target as HTMLElement;
    if (!target.hasAttribute('data-word')) return;
    for (const w of this.words()) w.tabIndex = w === target ? 0 : -1;
  }

  protected onKey(e: KeyboardEvent): void {
    const list = this.words();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    // `Record` (TS): tecla → índice destino (fuera de rango se corrige con Math.min/max)
    const next: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowDown: i + 1,
      ArrowLeft: i - 1,
      ArrowUp: i - 1,
      Home: 0,
      End: list.length - 1,
    };
    if (!(e.key in next)) return;
    e.preventDefault(); // Sin desplazar la página con las flechas
    list[Math.max(0, Math.min(list.length - 1, next[e.key]))]?.focus();
  }
}
