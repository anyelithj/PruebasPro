import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { GrammarFacade } from '@features/grammar/application/grammar.facade';
import { GrammarRepository } from '@features/grammar/domain/grammar.repository.port';
import { GrammarHttpRepository } from '@features/grammar/infrastructure/grammar.http-repository';
import GrammarEditorPage from '@features/grammar/presentation/pages/grammar-editor.page';
import { DictionaryRepository } from '@core/dictionary/dictionary.repository.port';
import { DictionaryHttpRepository } from '@core/dictionary/dictionary.http-repository';
import { gDetail, gTopic } from '@testing/polyglot-grammar';
// [Spec GrammarEditorPage · Sprint 10.12 · RF-135]: lista de fichas con estado, ficha en edición con vista previa, publicar y error del borrador con IA visible | [Herramienta]: render() + msw

// [Diccionario]: los ejemplos usan <aula-word-lookup> (DictionaryFacade de core) → su adaptador HTTP real contra msw
const providers = [{ provide: GrammarRepository, useClass: GrammarHttpRepository }, GrammarFacade, { provide: DictionaryRepository, useClass: DictionaryHttpRepository }];

describe('GrammarEditorPage', () => {
  it('sin ficha elegida: lista con estado y aviso para elegir', async () => {
    server.use(http.get(`${API}/grammar/topics`, () => HttpResponse.json(envelope([gTopic({ status: 'draft' })]))));
    const { el } = await render(GrammarEditorPage, providers);
    expect(el.querySelector('a[href="/gramatica/editor/g1"]')?.textContent).toContain('Borrador');
    expect(el.textContent).toContain('Elige una ficha');
  });

  it('ficha en borrador: vista previa y «Publicar» envía status', async () => {
    let body: unknown;
    server.use(
      http.get(`${API}/grammar/topics`, () => HttpResponse.json(envelope([gTopic({ status: 'draft' })]))),
      http.get(`${API}/grammar/topics/g1`, () => HttpResponse.json(envelope(gDetail({ status: 'draft' })))),
      http.patch(`${API}/grammar/topics/g1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope(gTopic()));
      }),
    );
    const { el, fixture } = await render(GrammarEditorPage, providers);
    fixture.componentRef.setInput('id', 'g1');
    await settle(fixture);
    expect(el.textContent).toContain('Vista previa');
    expect(el.textContent).toContain('IPA y traducción automáticos'); // Ejemplo sin revisar en la vista previa
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Publicar'))!.click();
    await settle(fixture);
    expect(body).toEqual({ status: 'published' });
  });

  it('error del borrador con IA → alerta', async () => {
    server.use(
      http.get(`${API}/grammar/topics`, () => HttpResponse.json(envelope([]))),
      http.post(`${API}/grammar/topics/draft`, () => HttpResponse.json({ message: 'La IA no devolvió secciones válidas' }, { status: 503 })),
    );
    const { el, fixture } = await render(GrammarEditorPage, providers);
    const title = el.querySelector<HTMLInputElement>('input[maxlength="120"]')!;
    title.value = 'Past Simple';
    title.dispatchEvent(new Event('input'));
    await settle(fixture);
    [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('borrador con IA'))!.click();
    await settle(fixture);
    expect(getByRole(el, 'alert').textContent).toContain('secciones');
  });
});
