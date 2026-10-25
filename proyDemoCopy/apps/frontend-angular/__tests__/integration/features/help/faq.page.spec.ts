import { signal } from '@angular/core';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { SessionService } from '@core/auth/session.service';
import { HELP_PROVIDERS } from '@features/help/help.routes';
import FaqPage from '@features/help/presentation/pages/faq.page';
// [Spec FaqPage]: lista pública, búsqueda instantánea con conteo anunciado, acciones solo para ADMIN y error | [Herramienta]: render() con HTTP real contra msw + sesión falsa

const faqs = [
  { id: 'f1', question: '¿Cómo pido mi certificado?', answer: 'En Mis certificados.', category: 'certificados', role: 'USER', locale: 'es', manualSlug: 'estudiante', reviewedAt: '2026-10-16T00:00:00Z' },
  { id: 'f2', question: '¿La plataforma cobra dinero real?', answer: 'No, modo de prueba.', category: 'pagos', role: 'ALL', locale: 'es', manualSlug: null, reviewedAt: '2026-10-16T00:00:00Z' },
];
const providers = (role: 'ADMIN' | 'USER' | null) => [
  ...HELP_PROVIDERS,
  { provide: SessionService, useValue: { hasRole: (r: string) => r === role, isAuthenticated: signal(role !== null), user: signal(null) } },
];

describe('FaqPage', () => {
  beforeEach(() => server.use(http.get(`${API}/help/faqs`, () => HttpResponse.json(envelope(faqs)))));

  it('visitante: ve las FAQ en acordeón nativo, sin botones de ADMIN', async () => {
    const { el } = await render(FaqPage, providers(null));
    expect(el.querySelectorAll('details summary')).toHaveLength(2);
    expect(el.textContent).not.toContain('Nueva pregunta');
    expect(el.querySelector('a[href="/ayuda/manual/estudiante"]')).not.toBeNull();
  });

  it('buscar filtra al teclear y anuncia el conteo', async () => {
    const { el, fixture } = await render(FaqPage, providers('USER'));
    const input = el.querySelector('#faq-search') as HTMLInputElement;
    input.value = 'dinero';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(getByRole(el, 'status').textContent).toContain('1 preguntas');
    expect(el.querySelectorAll('details')).toHaveLength(1);
  });

  it('ADMIN: «Nueva pregunta» y editar/archivar con el nombre de la pregunta', async () => {
    const { el } = await render(FaqPage, providers('ADMIN'));
    expect(el.textContent).toContain('Nueva pregunta');
    expect(el.querySelector('button[aria-label="Archivar: ¿Cómo pido mi certificado?"]')).not.toBeNull();
  });

  it('error al cargar', async () => {
    server.use(http.get(`${API}/help/faqs`, () => HttpResponse.json({ message: 'Servicio no disponible' }, { status: 500 })));
    const { el } = await render(FaqPage, providers(null));
    expect(getByRole(el, 'alert').textContent).toBeTruthy();
  });
});
