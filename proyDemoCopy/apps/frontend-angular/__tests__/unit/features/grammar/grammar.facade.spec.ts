import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { GrammarFacade } from '@features/grammar/application/grammar.facade';
import { GrammarRepository } from '@features/grammar/domain/grammar.repository.port';
import { gDetail, gTopic } from '@testing/polyglot-grammar';
// [Spec GrammarFacade · Sprints 10.11/10.12]: traducción visible por defecto; editar recarga la ficha; borrador con IA devuelve el id; error visible | [Patrón]: Test Double (repositorio falso)

function setup(over: Record<string, jest.Mock> = {}) {
  const repo = {
    listTopics: jest.fn(() => of([gTopic()])),
    getTopic: jest.fn(() => of(gDetail())),
    draft: jest.fn(() => of({ id: 'g9', sections: 5, model: 'qwen2.5:3b' })),
    addExample: jest.fn(() => of({})),
    updateTopic: jest.fn(() => of(gTopic({ status: 'draft' }))),
    ...over,
  };
  TestBed.configureTestingModule({ providers: [GrammarFacade, { provide: GrammarRepository, useValue: repo }] });
  return { g: TestBed.inject(GrammarFacade), repo };
}

describe('GrammarFacade', () => {
  it('la traducción empieza visible y la ficha trae secciones con ejemplos', async () => {
    const { g } = setup();
    expect(g.showTranslation()).toBe(true);
    await g.loadTopic('g1');
    expect(g.topic.data()?.sections[0].examples[0].translation).toBe('es-e1');
  });

  it('agregar un ejemplo recarga la ficha', async () => {
    const { g, repo } = setup();
    expect(await g.addExample('g1', 's2', 'She works.')).toBe(true);
    expect(repo.addExample).toHaveBeenCalledWith('s2', 'She works.');
    expect(repo.getTopic).toHaveBeenCalledWith('g1');
  });

  it('borrador con IA devuelve el id de la ficha nueva', async () => {
    const { g, repo } = setup();
    expect(await g.draft({ title: 'Past Simple', language: 'en', level: 'A2' })).toBe('g9');
    expect(repo.draft).toHaveBeenCalledWith({ title: 'Past Simple', language: 'en', level: 'A2' });
  });

  it('error de la IA → visible', async () => {
    const { g } = setup({ draft: jest.fn(() => throwError(() => new Error('La IA no devolvió secciones válidas'))) });
    expect(await g.draft({ title: 'X y', language: 'en', level: 'A1' })).toBeNull();
    expect(g.actionError()).toContain('secciones');
  });
});
