import { Component } from '@angular/core';
import { of } from 'rxjs';
import { DictionaryRepository } from '@core/dictionary/dictionary.repository.port';
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
    const learn = [...el.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((b) => b.textContent?.includes('Aprender'))!;
    learn.click();
    await settle(fixture);
    expect(r.mark).toHaveBeenCalledWith(expect.objectContaining({ language: 'en', word: 'run', translation: 'correr' }));
    expect(words()[1].className).toContain('decoration-dotted');
  });
});
