import { TestBed } from '@angular/core/testing';
import { MemoryBoardComponent } from '@features/games/presentation/components/memory-board.component';
// [Spec MemoryBoard · 2026-11-14]: como el memo de 50languages — las dos cartas de una pareja muestran la MISMA imagen + su texto
// (palabra en el idioma meta con `lang` correcto · traducción en español) | [Patrón]: Test de componente presentacional (setInput + DOM)

const IMG = 'https://example.org/cat.png';

function board(items: { term: string; translation?: string; emoji?: string; image?: string }[]) {
  const fixture = TestBed.createComponent(MemoryBoardComponent);
  fixture.componentRef.setInput('items', items);
  fixture.componentRef.setInput('language', 'fr');
  fixture.detectChanges();
  const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  return { fixture, buttons };
}

describe('MemoryBoardComponent', () => {
  it('pareja: misma imagen; una carta con la palabra (lang=fr) y la otra con la traducción (lang=es)', () => {
    const { fixture, buttons } = board([{ term: 'le chat', translation: 'el gato', image: IMG }]);
    buttons()[0].click();
    fixture.detectChanges();
    buttons()[1].click(); // Dos volteadas: ambas visibles durante la pausa
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(Array.from(el.querySelectorAll('img')).map((i) => i.getAttribute('src'))).toEqual([IMG, IMG]);
    expect(el.querySelector('[lang="fr"]')?.textContent).toBe('le chat');
    expect(el.querySelector('[lang="es"]')?.textContent).toBe('el gato');
  });

  it('sin imagen: emoji en las dos cartas; sin traducción, la segunda carta usa el emoji como texto', () => {
    const { fixture, buttons } = board([{ term: 'sun', emoji: '☀️' }]);
    buttons()[0].click();
    fixture.detectChanges();
    buttons()[1].click();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[lang="fr"]')?.textContent).toBe('sun');
    expect(el.querySelector('[lang="es"]')?.textContent).toBe('☀️');
  });
});
