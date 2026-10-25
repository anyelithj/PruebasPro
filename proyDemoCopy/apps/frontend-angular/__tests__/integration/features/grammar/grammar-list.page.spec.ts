import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { GrammarFacade } from '@features/grammar/application/grammar.facade';
import { GrammarRepository } from '@features/grammar/domain/grammar.repository.port';
import { GrammarHttpRepository } from '@features/grammar/infrastructure/grammar.http-repository';
import GrammarListPage from '@features/grammar/presentation/pages/grammar-list.page';
import { sessionAs } from '@testing/music-dialogues';
import { gTopic } from '@testing/polyglot-grammar';
// [Spec GrammarListPage · Sprint 10.11]: tarjetas por ficha con idioma y nivel y enlace a la ficha; el docente ve el editor; vacío y error | [Herramienta]: render() + msw

const providers = (role: 'USER' | 'TEACHER' = 'USER') => [{ provide: GrammarRepository, useClass: GrammarHttpRepository }, GrammarFacade, sessionAs(role)];

describe('GrammarListPage', () => {
  it('estudiante: tarjeta con nivel y enlace a la ficha', async () => {
    server.use(http.get(`${API}/grammar/topics`, () => HttpResponse.json(envelope([gTopic()]))));
    const { el } = await render(GrammarListPage, providers());
    expect(el.textContent).toContain('Present Simple');
    expect(el.textContent).toContain('A1');
    expect(el.querySelector('a[href="/gramatica/g1"]')).not.toBeNull();
    expect(el.querySelector('a[href="/gramatica/editor"]')).toBeNull();
  });

  it('docente: acceso al editor', async () => {
    server.use(http.get(`${API}/grammar/topics`, () => HttpResponse.json(envelope([]))));
    const { el } = await render(GrammarListPage, providers('TEACHER'));
    expect(el.querySelector('a[href="/gramatica/editor"]')).not.toBeNull();
    expect(el.textContent).toContain('Aún no hay fichas');
  });

  it('error → alerta', async () => {
    server.use(http.get(`${API}/grammar/topics`, () => HttpResponse.json({ message: 'Caído' }, { status: 500 })));
    const { el } = await render(GrammarListPage, providers());
    expect(getByRole(el, 'alert')).toBeTruthy();
  });
});
