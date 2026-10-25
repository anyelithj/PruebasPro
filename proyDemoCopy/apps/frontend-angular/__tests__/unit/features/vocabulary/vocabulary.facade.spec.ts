import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '@core/http/error.interceptor';
import { VocabularyEntryFacade } from '@features/vocabulary/application/vocabulary-entry.facade';
import { VocabularyFacade } from '@features/vocabulary/application/vocabulary.facade';
import { VocabularyRepository } from '@features/vocabulary/domain/vocabulary.repository.port';
import { ipaFor } from '@features/vocabulary/domain/models/vocabulary';
// [Spec VocabularyFacade + VocabularyEntryFacade · Sprint 8.3]: historial sin duplicados, guardar en el banco, corrección que relee y error visible + regla pura ipaFor (UK/US) | [Patrón]: Test Double (repositorio falso)

const lookup = (id: string, text: string) => ({ id, kind: 'term' as const, language: 'en', text, hits: 0, result: { ipa: null, ipa_uk: 'ʌmbɹˈɛlə', ipa_us: 'ʌmbɹˈɛlɚ', engine: 'espeak-ng', translation: { translation: 'paraguas', alternatives: [], model: 'qwen' } } });
const entry = { id: 'e1', language: 'en', term: 'umbrella', translation: 'paraguas', alternatives: [], ipaUk: 'a', ipaUs: 'b', ipa: null, example: null, sourceItemId: null, reviewed: false, createdAt: '' };

function setup(overrides: Partial<VocabularyRepository> = {}) {
  const repo = {
    lookup: jest.fn((i: { text: string }) => of(lookup(i.text === 'umbrella' ? 'l1' : 'l2', i.text))),
    create: jest.fn(() => of(entry)),
    list: jest.fn(() => of([entry])),
    get: jest.fn(() => of({ ...entry, reviewed: true })),
    update: jest.fn(() => of({ ...entry, reviewed: true })),
    remove: jest.fn(() => of(undefined)),
    ...overrides,
  } as unknown as VocabularyRepository;
  TestBed.configureTestingModule({ providers: [VocabularyFacade, VocabularyEntryFacade, { provide: VocabularyRepository, useValue: repo }] });
  return { lookupFacade: TestBed.inject(VocabularyFacade), bank: TestBed.inject(VocabularyEntryFacade), repo };
}

describe('VocabularyFacade', () => {
  it('consulta y guarda el historial reciente sin duplicados (la última primero)', async () => {
    const { lookupFacade } = setup();
    await lookupFacade.lookup({ text: 'umbrella', language: 'en' });
    await lookupFacade.lookup({ text: 'bus', language: 'en' });
    await lookupFacade.lookup({ text: 'umbrella', language: 'en' });
    expect(lookupFacade.history().map((h) => h.text)).toEqual(['umbrella', 'bus']);
    expect(lookupFacade.result.status()).toBe('success');
  });

  it('guardar en el banco crea la entrada con idioma y término y confirma', async () => {
    const { lookupFacade, repo } = setup();
    const r = (await lookupFacade.lookup({ text: 'umbrella', language: 'en' }))!;
    expect(await lookupFacade.saveToBank(r)).toBe(true);
    expect(repo.create).toHaveBeenCalledWith({ language: 'en', term: 'umbrella' });
    expect(lookupFacade.saved()).toBe('umbrella');
  });

  it('ipaFor: inglés según acento; otros idiomas, única variante', () => {
    expect(ipaFor('en', 'uk', { ipaUk: 'uk', ipaUs: 'us' })).toBe('uk');
    expect(ipaFor('en', 'us', { ipa_uk: 'uk', ipa_us: 'us' })).toBe('us');
    expect(ipaFor('fr', 'uk', { ipa: 'fʁ' })).toBe('fʁ');
  });
});

describe('VocabularyEntryFacade', () => {
  it('corregir relee la lista y la ficha (queda «revisado»)', async () => {
    const { bank, repo } = setup();
    await bank.load({});
    expect(await bank.correct('e1', { translation: 'sombrilla' })).toBe(true);
    expect(repo.update).toHaveBeenCalledWith('e1', { translation: 'sombrilla' });
    expect(repo.list).toHaveBeenCalledTimes(2);
    expect(bank.selected.data()?.reviewed).toBe(true);
  });

  it('error del backend visible y lista vacía = estado «empty»', async () => {
    const { bank } = setup({ list: () => of([]), remove: () => throwError(() => new ApiError(404, 'Entrada no encontrada')) });
    await bank.load({});
    expect(bank.list.status()).toBe('empty');
    expect(await bank.remove('x')).toBe(false);
    expect(bank.actionError()).toContain('no encontrada');
    expect(bank.busy()).toBe(false);
  });
});
