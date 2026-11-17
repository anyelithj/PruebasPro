import { Component } from '@angular/core';
import { of } from 'rxjs';
import { DictionaryRepository } from '@core/dictionary/dictionary.repository.port';
import { placeWordCard } from '@shared/ui/organisms/word-lookup/word-card.component';
import { WordLookupComponent } from '@shared/ui/organisms/word-lookup/word-lookup.component';
import { render, settle } from '@testing/render';
import { marked, wordLookup } from '@testing/polyglot-grammar';
// [Spec WordLookupComponent · Sprint 10.3 · RF-136/RF-137]: abre con clic y con Enter, muestra traducción e IPA, cierra con Escape y devuelve el foco; una sola parada de tabulación con flechas; resalta palabras en estudio y «Aprender» llama al backend | [Herramienta]: render() con repositorio falso

@Component({
  imports: [WordLookupComponent],
  template: `<aula-word-lookup text="I run every day." language="en" />`,
})
class Host {}

const repo = () => ({
  lookup: jest.fn(() => of(wordLookup())),
  ipa: jest.fn(() => of({ ipa: 'rʌn-uk', ipa_us: 'rʌn-us' })),
  listMarked: jest.fn(() => of([marked('every')])),
  mark: jest.fn(() => of(marked('run'))),
  setStatus: jest.fn(),
  unmark: jest.fn(),
});

async function mount() {
  const r = repo();
  const { fixture, el } = await render(Host, [{ provide: DictionaryRepository, useValue: r }]);
  const words = () => [...el.querySelectorAll<HTMLButtonElement>('button[data-word]')];
  return { fixture, el, words, r };
}

describe('WordLookupComponent', () => {
  it('pinta cada palabra como botón; solo la primera es tabulable y las flechas mueven el foco', async () => {
    const { words, fixture } = await mount();
    expect(words().map((w) => w.textContent?.trim())).toEqual(['I', 'run', 'every', 'day']);
    expect(words().map((w) => w.tabIndex)).toEqual([0, -1, -1, -1]);
    words()[0].focus();
    words()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await settle(fixture);
    expect(document.activeElement).toBe(words()[1]);
    expect(words()[1].tabIndex).toBe(0);
  });

  it('resalta la palabra que se está aprendiendo (también en el nombre accesible)', async () => {
    const { words } = await mount();
    expect(words()[2].className).toContain('decoration-dotted');
    expect(words()[2].getAttribute('aria-label')).toContain('Aprendiendo');
  });

  it('clic → ventana con traducción, IPA y ejemplos; Escape cierra y devuelve el foco', async () => {
    const { el, words, fixture, r } = await mount();
    words()[1].click();
    await settle(fixture);
    const dialog = el.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('correr');
    expect(dialog.textContent).toMatch(/rʌn-(uk|us)/);
    expect(r.lookup).toHaveBeenCalledWith({ language: 'en', word: 'run', sentence: 'I run every day.' });
    expect(words()[1].getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle(fixture);
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(words()[1]);
  });

  it('«Aprender» marca la palabra y la resalta', async () => {
    const { el, words, fixture, r } = await mount();
    words()[1].click();
    await settle(fixture);
    const learn = [...el.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((b) => b.textContent?.includes('Repasar'))!;
    learn.click();
    await settle(fixture);
    expect(r.mark).toHaveBeenCalledWith(expect.objectContaining({ language: 'en', word: 'run', translation: 'correr' }));
    expect(words()[1].className).toContain('decoration-dotted');
  });
});

// [2026-11-14 · rule-words]: en fichas de pronunciación se resaltan SOLO las palabras del sonido; las marcas «aprender» del usuario no salen (antes «I», «some»)
@Component({
  imports: [WordLookupComponent],
  template: `<aula-word-lookup text="I run every day." language="en" ruleWords="run, Day" />`,
})
class RuleHost {}

describe('WordLookupComponent · modo regla', () => {
  it('negrita + subrayado en las palabras de la regla y sin marcas del usuario', async () => {
    const { el } = await render(RuleHost, [{ provide: DictionaryRepository, useValue: repo() }]);
    const words = [...el.querySelectorAll<HTMLButtonElement>('button[data-word]')];
    expect(words.map((w) => w.className.includes('font-bold'))).toEqual([false, true, false, true]);
    expect(words[2].className).not.toContain('decoration-dotted'); // «every» está marcada, pero no es de la regla
  });
});

// [2026-10-31]: como el diccionario de Cursos: encima si cabe, debajo si no, siempre dentro de la pantalla
describe('placeWordCard', () => {
  it('encima de la palabra con flecha al centro', () => {
    const p = placeWordCard({ left: 500, top: 400, bottom: 420, width: 40 }, 1000, 800);
    expect(p).toEqual({ left: 380, above: true, top: 'auto', bottom: '412px', arrow: 140 });
  });
  it('sin sitio arriba va debajo y no se sale por el borde', () => {
    const p = placeWordCard({ left: 0, top: 50, bottom: 70, width: 20 }, 320, 800);
    expect(p).toMatchObject({ left: 8, above: false, top: '82px', bottom: 'auto', arrow: 12 });
  });
});
