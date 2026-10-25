import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { GrammarHttpRepository } from '@features/grammar/infrastructure/grammar.http-repository';
import { gDetail, gExample, gTopic } from '@testing/polyglot-grammar';
// [Spec GrammarHttpRepository · Sprints 10.11/10.12]: filtros de la lista, ficha completa validada, borrador con IA (solo título, idioma y nivel) y corrección de un ejemplo | [Herramienta]: msw 2

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), GrammarHttpRepository] });
  return TestBed.inject(GrammarHttpRepository);
}

describe('GrammarHttpRepository', () => {
  it('lista con idioma, nivel y mine; ficha con secciones y ejemplos', async () => {
    let url = '';
    server.use(
      http.get(`${API}/grammar/topics`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(envelope([gTopic()]));
      }),
      http.get(`${API}/grammar/topics/g1`, () => HttpResponse.json(envelope(gDetail()))),
    );
    const repo = setup();
    await firstValueFrom(repo.listTopics({ language: 'en', level: 'A1', mine: true }));
    expect(new URL(url).searchParams.toString()).toBe('language=en&level=A1&mine=1');
    const t = await firstValueFrom(repo.getTopic('g1'));
    expect(t.sections[1].type).toBe('formula');
  });

  it('borrador con IA y corrección de un ejemplo', async () => {
    let draftBody: unknown;
    let patchBody: unknown;
    server.use(
      http.post(`${API}/grammar/topics/draft`, async ({ request }) => {
        draftBody = await request.json();
        return HttpResponse.json(envelope({ id: 'g9', sections: 5, model: 'qwen2.5:3b' }));
      }),
      http.patch(`${API}/grammar/examples/e1`, async ({ request }) => {
        patchBody = await request.json();
        return HttpResponse.json(envelope(gExample('e1', 'I drink tea.', { reviewed: true })));
      }),
    );
    const repo = setup();
    expect((await firstValueFrom(repo.draft({ title: 'Past', language: 'en', level: 'A2', summary: 'x' }))).id).toBe('g9');
    expect(draftBody).toEqual({ title: 'Past', language: 'en', level: 'A2' });
    expect((await firstValueFrom(repo.updateExample('e1', { ipa: 'aɪ' }))).reviewed).toBe(true);
    expect(patchBody).toEqual({ ipa: 'aɪ' });
  });
});
