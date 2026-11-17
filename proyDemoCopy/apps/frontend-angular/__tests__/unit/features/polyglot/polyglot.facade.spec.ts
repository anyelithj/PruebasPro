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

  // [Fix 2026-10-31]: «Probar» de Gestión → Actividades abre el tema del enlace, no el primero
  it('abre el tema del enlace (?tema=); si no existe, el primero', async () => {
    const linked = setup();
    await linked.p.loadTopics('p2');
    expect(linked.p.topicId()).toBe('p2');
    TestBed.resetTestingModule();
    const unknown = setup();
    await unknown.p.loadTopics('borrador-ajeno');
    expect(unknown.p.topicId()).toBe('p1');
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

  it('borrador con IA devuelve cuántos conceptos se agregaron y recarga la tabla', async () => {
    const { p, repo } = setup();
    await p.loadTopics();
    repo.table.mockClear();
    expect(await p.draft('word', 5)).toBe(3);
    expect(repo.draft).toHaveBeenCalledWith('p1', { kind: 'word', count: 5 });
    expect(repo.table).toHaveBeenCalledTimes(1);
  });

  it('error de la acción → visible', async () => {
    // [2026-11-14]: las comparaciones guardadas salieron de la vista del estudiante → el error se comprueba con otra acción (borrador con IA)
    const { p } = setup({ draft: jest.fn(() => throwError(() => new Error('Tema no encontrado'))) });
    await p.loadTopics();
    expect(await p.draft('word', 5)).toBeNull();
    expect(p.actionError()).toBe('Tema no encontrado');
  });
});
