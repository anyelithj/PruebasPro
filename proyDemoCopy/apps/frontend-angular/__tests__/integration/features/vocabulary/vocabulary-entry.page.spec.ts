import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { VocabularyEntryFacade } from '@features/vocabulary/application/vocabulary-entry.facade';
import { VocabularyFacade } from '@features/vocabulary/application/vocabulary.facade';
import { VocabularyRepository } from '@features/vocabulary/domain/vocabulary.repository.port';
import { VocabularyHttpRepository } from '@features/vocabulary/infrastructure/vocabulary.http-repository';
import VocabularyEntryPage from '@features/vocabulary/presentation/pages/vocabulary-entry.page';
// [Spec VocabularyEntryPage · Sprint 8.3]: banco con estado «Automático/Revisado» en texto, vacío, detalle /vocabulario/:id con formulario de corrección y error | [Herramienta]: render() + msw

const providers = [{ provide: VocabularyRepository, useClass: VocabularyHttpRepository }, VocabularyFacade, VocabularyEntryFacade];
const entry = (id: string, reviewed: boolean) => ({ id, userId: 'u1', language: 'en', term: id === 'e1' ? 'umbrella' : 'bus', termKey: '', translation: 'paraguas', alternatives: [], ipaUk: 'ʌmbɹˈɛlə', ipaUs: 'ʌmbɹˈɛlɚ', ipa: null, example: null, sourceItemId: null, reviewed, createdAt: '', updatedAt: '' });

describe('VocabularyEntryPage', () => {
  it('lista: términos con estado en texto y acciones con nombre accesible', async () => {
    server.use(http.get(`${API}/vocabulary`, () => HttpResponse.json(envelope([entry('e1', false), entry('e2', true)]))));
    const { el } = await render(VocabularyEntryPage, providers);
    expect(el.querySelector('h1')?.textContent).toContain('Mi vocabulario');
    expect(el.textContent).toContain('Automático');
    expect(el.textContent).toContain('Revisado');
    expect(getByRole(el, 'button', 'Corregir: umbrella')).toBeTruthy();
    expect(el.querySelector('caption')?.textContent).toContain('Mi vocabulario');
  });

  it('banco vacío → mensaje con la acción siguiente', async () => {
    server.use(http.get(`${API}/vocabulary`, () => HttpResponse.json(envelope([]))));
    const { el } = await render(VocabularyEntryPage, providers);
    expect(el.textContent).toContain('Aún no tienes palabras');
  });

  it('/vocabulario/:id abre la corrección con IPA UK y US', async () => {
    server.use(
      http.get(`${API}/vocabulary`, () => HttpResponse.json(envelope([entry('e1', false)]))),
      http.get(`${API}/vocabulary/e1`, () => HttpResponse.json(envelope(entry('e1', false)))),
    );
    const r = await render(VocabularyEntryPage, providers);
    r.fixture.componentRef.setInput('id', 'e1');
    await settle(r.fixture);
    expect(r.el.textContent).toContain('Corregir «umbrella»');
    expect(r.el.querySelector('#entry-ipa-uk')).not.toBeNull();
    expect(r.el.textContent).toContain('La corrección manual prevalece');
  });

  it('error al cargar → alerta', async () => {
    server.use(http.get(`${API}/vocabulary`, () => HttpResponse.json({ message: 'Sesión expirada' }, { status: 500 })));
    const { el } = await render(VocabularyEntryPage, providers);
    expect(getByRole(el, 'alert')).toBeTruthy();
  });
});
