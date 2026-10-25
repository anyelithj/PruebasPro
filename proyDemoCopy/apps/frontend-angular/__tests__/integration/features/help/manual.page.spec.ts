import { signal } from '@angular/core';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { SessionService } from '@core/auth/session.service';
import { HELP_PROVIDERS } from '@features/help/help.routes';
import ManualPage from '@features/help/presentation/pages/manual.page';
// [Spec ManualPage]: índice por rol con secciones enlazadas por ancla, vacío explicativo, reindexado ADMIN con aviso si el agente no responde | [Herramienta]: render() contra msw + sesión falsa

const entry = { slug: 'estudiante', title: 'Manual del estudiante', role: 'USER', locale: 'es', sections: ['Cómo pagar', 'Mis certificados'], updatedAt: '2026-10-16T00:00:00Z' };
const providers = (role: 'ADMIN' | 'USER') => [...HELP_PROVIDERS, { provide: SessionService, useValue: { hasRole: (r: string) => r === role, isAuthenticated: signal(true), user: signal(null) } }];

describe('ManualPage', () => {
  it('lista artículos y enlaza cada sección con su ancla', async () => {
    server.use(http.get(`${API}/help/manual`, () => HttpResponse.json(envelope([entry]))));
    const { el } = await render(ManualPage, providers('USER'));
    expect(el.textContent).toContain('Manual del estudiante');
    expect(el.querySelector('a[href="/ayuda/manual/estudiante#como-pagar"]')).not.toBeNull();
    expect(el.textContent).not.toContain('Reindexar manual');
  });

  it('sin artículos explica que falta publicarlo', async () => {
    server.use(http.get(`${API}/help/manual`, () => HttpResponse.json(envelope([]))));
    const { el } = await render(ManualPage, providers('USER'));
    expect(el.textContent).toContain('aún no está publicado');
  });

  it('ADMIN reindexa: resumen en role="status" y aviso si el índice no se actualizó', async () => {
    server.use(
      http.get(`${API}/help/manual`, () => HttpResponse.json(envelope([entry]))),
      http.post(`${API}/help/manual/reindex`, () => HttpResponse.json(envelope({ articles: 4, updated: 4, removed: 0, faqsSeeded: 9, sections: null, faqIndexed: false }), { status: 201 })),
    );
    const { el, fixture } = await render(ManualPage, providers('ADMIN'));
    const btn = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Reindexar manual')) as HTMLButtonElement;
    btn.click();
    await settle(fixture);
    const status = [...el.querySelectorAll('[role="status"]')].map((s) => s.textContent).join(' ');
    expect(status).toContain('4 artículos');
    expect(status).toContain('El Agente Guía no está disponible');
    expect(getByRole(el, 'log')).toBeTruthy(); // Chat del Agente Guía en línea
  });
});
