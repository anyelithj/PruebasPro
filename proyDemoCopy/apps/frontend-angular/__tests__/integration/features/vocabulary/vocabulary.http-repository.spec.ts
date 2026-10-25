import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { ApiError } from '@core/http/error.interceptor';
import { VocabularyHttpRepository } from '@features/vocabulary/infrastructure/vocabulary.http-repository';
// [Spec VocabularyHttpRepository · Sprint 8.3]: POST /vocabulary/lookup con el contrato de la caché, filtros como query, PATCH de corrección y 400 → ApiError | [Herramienta]: msw 2

const lookup = { id: 'l1', fingerprint: 'x', kind: 'term', language: 'en', text: 'umbrella', context: null, result: { ipa: null, ipa_uk: 'ʌmbɹˈɛlə', ipa_us: 'ʌmbɹˈɛlɚ', engine: 'espeak-ng 1.52.0', language: 'en', text: 'umbrella', translation: { translation: 'paraguas', alternatives: ['sombrilla'], model: 'qwen2.5:3b', tone: 'neutral' } }, engine: 'espeak-ng 1.52.0', hits: 2, createdAt: '' };
const entry = { id: 'e1', userId: 'u1', language: 'en', term: 'umbrella', termKey: 'umbrella', translation: 'paraguas', alternatives: [], ipaUk: 'a', ipaUs: 'b', ipa: null, example: null, sourceItemId: null, reviewed: false, createdAt: '', updatedAt: '' };

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), VocabularyHttpRepository] });
  return TestBed.inject(VocabularyHttpRepository);
}

describe('VocabularyHttpRepository', () => {
  it('lookup: envía idioma y texto y mapea IPA UK/US + traducción', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/vocabulary/lookup`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope(lookup), { status: 201 });
      }),
    );
    const r = await firstValueFrom(setup().lookup({ language: 'en', text: 'umbrella' }));
    expect(body).toEqual({ language: 'en', text: 'umbrella' });
    expect(r.result.ipa_us).toBe('ʌmbɹˈɛlɚ');
    expect(r.result.translation.alternatives).toEqual(['sombrilla']);
  });

  it('list: solo los filtros con valor viajan como query; update usa PATCH', async () => {
    let url = '';
    server.use(
      http.get(`${API}/vocabulary`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(envelope([entry]));
      }),
      http.patch(`${API}/vocabulary/e1`, () => HttpResponse.json(envelope({ ...entry, reviewed: true }))),
    );
    const repo = setup();
    await firstValueFrom(repo.list({ language: 'en', q: '  ' }));
    expect(new URL(url).searchParams.toString()).toBe('language=en');
    expect((await firstValueFrom(repo.update('e1', { ipaUk: 'x' }))).reviewed).toBe(true);
  });

  it('texto vacío → 400 del backend como ApiError', async () => {
    server.use(http.post(`${API}/vocabulary`, () => HttpResponse.json({ message: 'term should not be empty' }, { status: 400 })));
    await expect(firstValueFrom(setup().create({ language: 'en', term: '' }))).rejects.toEqual(new ApiError(400, 'term should not be empty'));
  });
});
