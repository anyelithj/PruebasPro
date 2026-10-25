import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PolyglotFacade } from '@features/polyglot/application/polyglot.facade';
import { PolyglotRepository } from '@features/polyglot/domain/polyglot.repository.port';
import { pgTable, pgTopic, pgView } from '@testing/polyglot-grammar';
// [Spec PolyglotFacade · Sprints 10.7/10.8]: primer tema por defecto con la tabla; reordenar no vuelve a pedir la tabla (agregar un idioma sí); vistas guardadas; borrador con IA recarga la tabla; error visible | [Patrón]: Test Double (repositorio falso)

function setup(over: Record<string, jest.Mock> = {}) {
  const repo = {
    listTopics: jest.fn(() => of([pgTopic(), pgTopic({ id: 'p2', title: 'Animales' })])),
    table: jest.fn(() => of(pgTable())),
    listViews: jest.fn(() => of([pgView])),
    saveView: jest.fn(() => of({ ...pgView, id: 'v2' })),
    deleteView: jest.fn(() => of(undefined)),
    draft: jest.fn(() => of({ added: 3, model: 'qwen2.5:3b' })),
    ...over,
  };
  TestBed.configureTestingModule({ providers: [PolyglotFacade, { provide: PolyglotRepository, useValue: repo }] });
  return { p: TestBed.inject(PolyglotFacade), repo };
}

describe('PolyglotFacade', () => {
  it('elige el primer tema y pide la tabla con los idiomas en orden', async () => {
    const { p, repo } = setup();
    await p.loadTopics();
    expect(p.topicId()).toBe('p1');
    expect(repo.table).toHaveBeenCalledWith('p1', ['en', 'de', 'fr', 'pt', 'ru', 'zh', 'es']);
  });

  it('mover un idioma no pide la tabla; agregar uno sí', async () => {
    const { p, repo } = setup();
    await p.loadTopics();
    repo.table.mockClear();
    p.moveLanguage('es', -1);
    expect(p.languages().at(-2)).toBe('es');
    p.toggleLanguage('de'); // Quitar
    expect(repo.table).not.toHaveBeenCalled();
    p.toggleLanguage('de'); // Agregar
    expect(repo.table).toHaveBeenCalledTimes(1);
  });

  it('guardar y abrir una comparación', async () => {
    const { p, repo } = setup();
    await p.loadTopics();
    await p.loadViews();
    expect(await p.saveView('Mi familia')).toBe(true);
    expect(repo.saveView).toHaveBeenCalledWith({ topicId: 'p1', name: 'Mi familia', languages: p.languages() });
    expect(p.views.data()?.[0].id).toBe('v2');
    p.openView(pgView);
    expect(p.languages()).toEqual(['es', 'en']);
  });

  it('borrador con IA devuelve cuántos conceptos se agregaron y recarga la tabla', async () => {
    const { p, repo } = setup();
    await p.loadTopics();
    repo.table.mockClear();
    expect(await p.draft('word', 5)).toBe(3);
    expect(repo.draft).toHaveBeenCalledWith('p1', { kind: 'word', count: 5 });
    expect(repo.table).toHaveBeenCalledTimes(1);
  });

  it('error de la acción → visible', async () => {
    const { p } = setup({ saveView: jest.fn(() => throwError(() => new Error('Tema no encontrado'))) });
    await p.loadTopics();
    expect(await p.saveView('x')).toBe(false);
    expect(p.actionError()).toBe('Tema no encontrado');
  });
});
