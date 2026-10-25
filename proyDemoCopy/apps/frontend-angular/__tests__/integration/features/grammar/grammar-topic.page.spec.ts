import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { GrammarFacade } from '@features/grammar/application/grammar.facade';
import { GrammarRepository } from '@features/grammar/domain/grammar.repository.port';
import { GrammarHttpRepository } from '@features/grammar/infrastructure/grammar.http-repository';
import GrammarTopicPage from '@features/grammar/presentation/pages/grammar-topic.page';
import { DictionaryRepository } from '@core/dictionary/dictionary.repository.port';
import { DictionaryHttpRepository } from '@core/dictionary/dictionary.http-repository';
import { gDetail } from '@testing/polyglot-grammar';
// [Spec GrammarTopicPage · Sprint 10.11 · RF-133/RF-134/RF-136]: secciones con nombre en español e icono, fórmula, ejemplo con IPA, traducción visible por defecto que se puede ocultar y palabras pulsables (diccionario) | [Herramienta]: render() + msw

// [Diccionario]: los ejemplos usan <aula-word-lookup> (DictionaryFacade de core) → su adaptador HTTP real contra msw
const providers = [{ provide: GrammarRepository, useClass: GrammarHttpRepository }, GrammarFacade, { provide: DictionaryRepository, useClass: DictionaryHttpRepository }];

describe('GrammarTopicPage', () => {
  it('ficha con secciones, traducción por defecto y diccionario en el ejemplo', async () => {
    server.use(http.get(`${API}/grammar/topics/g1`, () => HttpResponse.json(envelope(gDetail()))));
    const { el, fixture } = await render(GrammarTopicPage, providers);
    fixture.componentRef.setInput('topicId', 'g1');
    await settle(fixture);
    expect(el.querySelector('h1')?.textContent).toContain('Present Simple');
    expect(el.textContent).toContain('Uso');
    expect(el.textContent).toContain('Fórmula');
    expect(el.textContent).toContain('Sujeto + verbo (+s)');
    expect(el.textContent).toContain('es-e1'); // Traducción visible por defecto
    expect(el.querySelectorAll('button[data-word]').length).toBe(5); // «I drink coffee every morning» → 5 palabras pulsables
    const toggle = [...el.querySelectorAll('button[aria-pressed]')].find((b) => b.textContent?.includes('traducción'))!;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    (toggle as HTMLButtonElement).click();
    await settle(fixture);
    expect(el.textContent).not.toContain('es-e1');
  });

  it('error → alerta', async () => {
    server.use(http.get(`${API}/grammar/topics/g1`, () => HttpResponse.json({ message: 'Ficha no encontrada' }, { status: 404 })));
    const { el, fixture } = await render(GrammarTopicPage, providers);
    fixture.componentRef.setInput('topicId', 'g1');
    await settle(fixture);
    expect(getByRole(el, 'alert').textContent).toContain('Ficha no encontrada');
  });
});
