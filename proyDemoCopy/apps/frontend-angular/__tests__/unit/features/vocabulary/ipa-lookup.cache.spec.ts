import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '@core/http/error.interceptor';
import { IpaLookupCache } from '@features/vocabulary/application/ipa-lookup.cache';
import { VocabularyRepository } from '@features/vocabulary/domain/vocabulary.repository.port';
// [Spec IpaLookupCache · 2026-10-27]: textos repetidos = una petición, 503 abre el circuito (sin tormenta de peticiones) y 4xx se recuerda | [Patrón]: Test Double (repositorio falso) | [Herramienta]: Jest

const lookup = (text: string) => ({ id: text, kind: 'term' as const, language: 'en', text, hits: 0, result: { ipa: null, ipa_uk: 'x', ipa_us: 'y', engine: 'espeak-ng', translation: { translation: '', alternatives: [], model: 'unavailable' } } });

function setup(impl: (i: { text: string }) => unknown) {
  const repo = { lookup: jest.fn(impl) } as unknown as VocabularyRepository;
  TestBed.configureTestingModule({ providers: [IpaLookupCache, { provide: VocabularyRepository, useValue: repo }] });
  return { cache: TestBed.inject(IpaLookupCache), repo };
}

describe('IpaLookupCache', () => {
  it('el mismo texto (sin distinguir mayúsculas) pide una sola vez', async () => {
    const { cache, repo } = setup((i) => of(lookup(i.text)));
    const [a, b] = await Promise.all([cache.get({ text: 'Umbrella', language: 'en' }), cache.get({ text: 'umbrella ', language: 'en' })]);
    expect(a?.text).toBe('Umbrella');
    expect(b).toBe(a);
    expect(repo.lookup).toHaveBeenCalledTimes(1);
  });

  it('un 503 abre el circuito: las demás fichas no llaman al servicio y devuelven null', async () => {
    const { cache, repo } = setup(() => throwError(() => new ApiError(503, 'El servicio de traducción e IPA no está disponible')));
    const texts = Array.from({ length: 10 }, (_, i) => `word ${i}`);
    const results = await Promise.all(texts.map((text) => cache.get({ text, language: 'en' })));
    expect(results.every((r) => r === null)).toBe(true);
    expect((repo.lookup as jest.Mock).mock.calls.length).toBeLessThanOrEqual(3); // Solo las que ya estaban en vuelo (MAX_IN_FLIGHT)
    expect(cache.available()).toBe(false);
    await cache.get({ text: 'otra', language: 'en' });
    expect((repo.lookup as jest.Mock).mock.calls.length).toBeLessThanOrEqual(3);
  });

  it('un 400 se recuerda como «sin IPA» y no abre el circuito', async () => {
    const { cache, repo } = setup(() => throwError(() => new ApiError(400, 'Idioma o texto no admitidos')));
    expect(await cache.get({ text: 'x', language: 'en' })).toBeNull();
    expect(await cache.get({ text: 'x', language: 'en' })).toBeNull();
    expect(repo.lookup).toHaveBeenCalledTimes(1);
    expect(cache.available()).toBe(true);
  });
});
