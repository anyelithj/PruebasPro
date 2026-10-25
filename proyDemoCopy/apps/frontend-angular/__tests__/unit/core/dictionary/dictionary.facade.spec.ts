import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DictionaryFacade } from '@core/dictionary/dictionary.facade';
import { ipaForAccent, segmentWords, termKey } from '@core/dictionary/dictionary.model';
import { DictionaryRepository } from '@core/dictionary/dictionary.repository.port';
import { marked, wordLookup } from '@testing/polyglot-grammar';
// [Spec DictionaryFacade · Sprint 10.3 · RF-136/RF-137]: consulta con caché (dos clics = una petición; un fallo no queda en caché), marcas por idioma, «Aprender» / «Aprendido» / quitar marca y funciones puras (segmentación, termKey, IPA por acento) | [Patrón]: Test Double (repositorio falso)

function setup(over: Partial<Record<keyof DictionaryRepository, jest.Mock>> = {}) {
  const repo = {
    lookup: jest.fn(() => of(wordLookup())),
    listMarked: jest.fn(() => of([marked('Run')])),
    mark: jest.fn(() => of(marked('cat'))),
    setStatus: jest.fn(() => of(marked('run', 'learned', 'm-Run'))),
    unmark: jest.fn(() => of(undefined)),
    ...over,
  };
  TestBed.configureTestingModule({ providers: [DictionaryFacade, { provide: DictionaryRepository, useValue: repo }] });
  return { dict: TestBed.inject(DictionaryFacade), repo };
}

describe('DictionaryFacade', () => {
  it('cachea la consulta por palabra y frase; un fallo se puede reintentar', async () => {
    const { dict, repo } = setup();
    await dict.lookup('en', 'Run', 'I run.');
    await dict.lookup('en', 'run ', 'I run.');
    expect(repo.lookup).toHaveBeenCalledTimes(1);
    expect(repo.lookup).toHaveBeenCalledWith({ language: 'en', word: 'Run', sentence: 'I run.' });

    repo.lookup.mockReturnValueOnce(throwError(() => new Error('503')));
    expect(await dict.lookup('en', 'walk')).toBeNull();
    expect(await dict.lookup('en', 'walk')).not.toBeNull(); // Reintenta (no quedó en caché)
  });

  it('palabra inválida (idioma desconocido) → null sin llamar al backend', async () => {
    const { dict, repo } = setup();
    expect(await dict.lookup('xx', 'hola')).toBeNull();
    expect(repo.lookup).not.toHaveBeenCalled();
  });

  it('carga las marcas una vez por idioma y las indexa por termKey', async () => {
    const { dict, repo } = setup();
    await dict.loadMarked('en');
    await dict.loadMarked('en');
    expect(repo.listMarked).toHaveBeenCalledTimes(1);
    expect(dict.statusOf('en', 'RUN')?.status).toBe('learning');
  });

  it('Aprender → Aprendido → quitar marca actualiza el mapa compartido', async () => {
    const { dict, repo } = setup();
    await dict.loadMarked('en');
    expect(await dict.markToLearn('en', 'cat', wordLookup({ translation: 'gato' }) as never, 'The cat sleeps.')).toBe(true);
    expect(repo.mark).toHaveBeenCalledWith({ language: 'en', word: 'cat', translation: 'gato', sentence: 'The cat sleeps.' });
    expect(dict.statusOf('en', 'cat')?.status).toBe('learning');
    expect(await dict.setStatus('en', 'run', 'learned')).toBe(true);
    expect(repo.setStatus).toHaveBeenCalledWith('m-Run', 'learned');
    expect(dict.statusOf('en', 'run')?.status).toBe('learned');
    expect(await dict.unmark('en', 'run')).toBe(true);
    expect(dict.statusOf('en', 'run')).toBeNull();
  });

  it('error al marcar → visible y sin cambiar el mapa', async () => {
    const { dict } = setup({ mark: jest.fn(() => throwError(() => new Error('Sin sesión'))) });
    expect(await dict.markToLearn('en', 'dog')).toBe(false);
    expect(dict.error()).toBe('Sin sesión');
    expect(dict.statusOf('en', 'dog')).toBeNull();
  });
});

describe('Modelo del diccionario', () => {
  it('segmentWords separa palabras de signos y espacios', () => {
    const toks = segmentWords('Hello, world!', 'en');
    expect(toks.filter((t) => t.word).map((t) => t.text)).toEqual(['Hello', 'world']);
    expect(toks.map((t) => t.text).join('')).toBe('Hello, world!'); // No se pierde texto
  });

  it('termKey normaliza y ipaForAccent elige UK/US solo en inglés', () => {
    expect(termKey('  Big   Apple ')).toBe('big apple');
    const r = { ipa: null, ipa_uk: 'uk', ipa_us: 'us' };
    expect(ipaForAccent('en', 'uk', r)).toBe('uk');
    expect(ipaForAccent('en', 'us', r)).toBe('us');
    expect(ipaForAccent('en', 'us', { ipa: 'base', ipaUs: 'term-us' })).toBe('term-us');
    expect(ipaForAccent('fr', 'us', { ipa: 'ʃa' })).toBe('ʃa');
  });
});
