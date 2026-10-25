import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { VocabularyEntryFacade } from '@features/vocabulary/application/vocabulary-entry.facade';
import { VocabularyFacade } from '@features/vocabulary/application/vocabulary.facade';
import { VocabularyRepository } from '@features/vocabulary/domain/vocabulary.repository.port';
import { VocabularyHttpRepository } from '@features/vocabulary/infrastructure/vocabulary.http-repository';
import LanguageLookupPage from '@features/vocabulary/presentation/pages/language-lookup.page';
// [Spec LanguageLookupPage · Sprint 8.3]: vacío inicial, deep link ?q= consulta y muestra IPA UK y US + traducción, IA caída → aviso (IPA sí), error → alerta | [Herramienta]: render() + msw

const providers = [{ provide: VocabularyRepository, useClass: VocabularyHttpRepository }, VocabularyFacade, VocabularyEntryFacade];
const lookup = (model = 'qwen2.5:3b', translation = 'paraguas') => ({ id: 'l1', kind: 'term', language: 'en', text: 'umbrella', hits: 0, result: { ipa: null, ipa_uk: 'ʌmbɹˈɛlə', ipa_us: 'ʌmbɹˈɛlɚ', engine: 'espeak-ng 1.52.0', translation: { translation, alternatives: [], model } } });

async function open(q?: string) {
  const r = await render(LanguageLookupPage, providers);
  if (q) {
    r.fixture.componentRef.setInput('q', q);
    r.fixture.componentRef.setInput('lang', 'en');
    await settle(r.fixture);
  }
  return r;
}

describe('LanguageLookupPage', () => {
  it('sin consulta: estado vacío con instrucciones', async () => {
    const { el } = await open();
    // [2026-10-23 · 4.º pase]: rediseño estilo Google Translate → título «Traductor», panel de traducción vacío y carga de CUALQUIER archivo (sin filtro accept)
    expect(el.querySelector('h1')?.textContent).toContain('Traductor');
    expect(el.textContent).toContain('La traducción aparecerá aquí');
    expect(el.querySelector('input[type="file"]')?.getAttribute('accept') ?? '').toBe('');
  });

  it('deep link ?q=umbrella: IPA británico y estadounidense + traducción + guardar', async () => {
    server.use(http.post(`${API}/vocabulary/lookup`, () => HttpResponse.json(envelope(lookup()), { status: 201 })));
    const { el } = await open('umbrella');
    expect(el.textContent).toContain('IPA británico');
    expect(el.textContent).toContain('/ʌmbɹˈɛlɚ/');
    expect(el.textContent).toContain('paraguas');
    expect(el.querySelector('[lang="en-fonipa"]')).not.toBeNull();
    expect(getByRole(el, 'button', 'Guardar en mi vocabulario')).toBeTruthy();
  });

  it('la IA local no respondió: aviso en texto, pero el IPA se muestra', async () => {
    server.use(http.post(`${API}/vocabulary/lookup`, () => HttpResponse.json(envelope(lookup('unavailable', '')), { status: 201 })));
    const { el } = await open('umbrella');
    expect(el.textContent).toContain('no respondió');
    expect(el.textContent).toContain('/ʌmbɹˈɛlə/');
  });

  it('error del backend → alerta', async () => {
    server.use(http.post(`${API}/vocabulary/lookup`, () => HttpResponse.json({ message: 'Servicio de IA no disponible' }, { status: 503 })));
    const { el } = await open('umbrella');
    // El traductor por trozos falla primero → mensaje propio de la pantalla (el detalle técnico queda en la red)
    expect(getByRole(el, 'alert').textContent).toContain('No se pudo traducir');
  });
});
