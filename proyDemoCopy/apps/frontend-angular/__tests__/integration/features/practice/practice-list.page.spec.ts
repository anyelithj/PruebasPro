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

  // [2026-11-03]: el constructor se abre desde Gestión → Actividades (no desde la lista del estudiante)
  it('docente: sin acceso al constructor aquí; vacío → mensaje', async () => {
    server.use(http.get(`${API}/practice/activities`, () => HttpResponse.json(envelope([]))));
    const { el } = await render(PracticeListPage, providers('TEACHER'));
    expect(el.querySelector('a[href="/practica/constructor"]')).toBeNull();
    expect(el.textContent).toContain('No hay actividades publicadas');
  });

  // [2026-11-11 · «Limpiar no limpia nada»]: el panel de filtros común vacía búsqueda, nivel y habilidad y vuelve a cargar la lista completa
  it('filtros: buscar oculta lo que no coincide y «Limpiar» lo deja todo vacío', async () => {
    const seen: string[] = [];
    server.use(
      http.get(`${API}/practice/activities`, ({ request }) => {
        seen.push(new URL(request.url).search);
        return HttpResponse.json(envelope([activity, { ...activity, id: 'a2', title: 'Pasado simple', description: '' }]));
      }),
    );
    const { fixture, el } = await render(PracticeListPage, providers('USER'));
    const input = el.querySelector<HTMLInputElement>('aula-filter-panel input[type=search]')!;
    const [level, skill] = Array.from(el.querySelectorAll<HTMLSelectElement>('aula-filter-panel select'));
    input.value = 'presente';
    input.dispatchEvent(new Event('input'));
    level.value = 'A2';
    level.dispatchEvent(new Event('change'));
    skill.value = 'grammar';
    skill.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(el.textContent).toContain('Presente simple');
    expect(el.textContent).not.toContain('Pasado simple');

    getByRole(el, 'button', 'Limpiar').click();
    for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r, 0)); await fixture.whenStable(); }
    expect(input.value).toBe('');
    expect(level.value).toBe('');
    expect(skill.value).toBe('');
    expect(el.textContent).toContain('Pasado simple');
    expect(seen.at(-1)).toBe(''); // Recarga sin filtros
  });

  it('error → alerta', async () => {
    server.use(http.get(`${API}/practice/activities`, () => HttpResponse.json({ message: 'Caído' }, { status: 500 })));
    const { el } = await render(PracticeListPage, providers('USER'));
    expect(getByRole(el, 'alert')).toBeTruthy();
  });
});
