import { signal } from '@angular/core';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { SessionService } from '@core/auth/session.service';
import { ActivityBuilderFacade } from '@features/practice/application/activity-builder.facade';
import { PracticeFacade } from '@features/practice/application/practice.facade';
import { PracticeRepository } from '@features/practice/domain/practice.repository.port';
import { PracticeHttpRepository } from '@features/practice/infrastructure/practice.http-repository';
import PracticeListPage from '@features/practice/presentation/pages/practice-list.page';
// [Spec PracticeListPage · Sprint 8.14]: actividades con nivel/habilidad en texto y enlace; constructor solo para docentes; vacío y error | [Herramienta]: render() + sesión falsa + msw

const providers = (role: 'USER' | 'TEACHER') => [
  { provide: PracticeRepository, useClass: PracticeHttpRepository },
  PracticeFacade,
  ActivityBuilderFacade,
  { provide: SessionService, useValue: { user: signal({ id: 'u1' }), role: signal(role), hasRole: (...r: string[]) => r.includes(role) } },
];
const activity = { id: 'a1', title: 'Presente simple', description: 'Tercera persona', language: 'en', level: 'A2', skill: 'grammar', status: 'published', aiDraft: false, createdBy: 't1', updatedAt: '' };

describe('PracticeListPage', () => {
  it('estudiante: tarjetas con nivel, habilidad y enlace; sin constructor', async () => {
    server.use(http.get(`${API}/practice/activities`, () => HttpResponse.json(envelope([activity]))));
    const { el } = await render(PracticeListPage, providers('USER'));
    expect(el.textContent).toContain('Presente simple');
    expect(el.textContent).toContain('Gramática');
    expect(el.querySelector('a[href="/practica/a1"]')).not.toBeNull();
    expect(el.querySelector('a[href="/practica/constructor"]')).toBeNull();
  });

  it('docente ve el acceso al constructor; vacío → mensaje', async () => {
    server.use(http.get(`${API}/practice/activities`, () => HttpResponse.json(envelope([]))));
    const { el } = await render(PracticeListPage, providers('TEACHER'));
    expect(el.querySelector('a[href="/practica/constructor"]')).not.toBeNull();
    expect(el.textContent).toContain('No hay actividades publicadas');
  });

  it('error → alerta', async () => {
    server.use(http.get(`${API}/practice/activities`, () => HttpResponse.json({ message: 'Caído' }, { status: 500 })));
    const { el } = await render(PracticeListPage, providers('USER'));
    expect(getByRole(el, 'alert')).toBeTruthy();
  });
});
