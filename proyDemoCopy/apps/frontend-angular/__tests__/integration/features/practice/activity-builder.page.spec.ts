import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { ActivityBuilderFacade } from '@features/practice/application/activity-builder.facade';
import { PracticeFacade } from '@features/practice/application/practice.facade';
import { PracticeRepository } from '@features/practice/domain/practice.repository.port';
import { PracticeHttpRepository } from '@features/practice/infrastructure/practice.http-repository';
import ActivityBuilderPage from '@features/practice/presentation/pages/activity-builder.page';
// [Spec ActivityBuilderPage · Sprint 8.15]: mis actividades con estado en texto (borrador de IA marcado), edición con ítems y publicar; el editor valida con la regla de NestJS antes de enviar | [Herramienta]: render() + setInput + msw

const providers = [{ provide: PracticeRepository, useClass: PracticeHttpRepository }, PracticeFacade, ActivityBuilderFacade];
const base = { id: 'a1', title: 'Mi día', description: '', language: 'en', level: 'A2', skill: 'grammar', status: 'draft', aiDraft: true, createdBy: 't1', updatedAt: '' };
const full = { ...base, items: [{ id: 'i1', position: 0, itemType: 'multiple_choice', skill: 'grammar', prompt: 'She ___ coffee', options: ['drink', 'drinks'], accepted: [['drinks']], corrections: {}, explanation: '', tip: '' }] };

describe('ActivityBuilderPage', () => {
  it('lista: borrador de IA marcado en texto y enlace para editar', async () => {
    server.use(http.get(`${API}/practice/activities`, () => HttpResponse.json(envelope([base]))));
    const { el } = await render(ActivityBuilderPage, providers);
    expect(el.textContent).toContain('Crear actividad');
    expect(el.textContent).toContain('Borrador');
    expect(el.textContent).toContain('Borrador de IA: revísalo');
    expect(el.querySelector('a[href="/practica/constructor/a1"]')).not.toBeNull();
  });

  it('edición: ítems + publicar envía status=published', async () => {
    let patch: unknown;
    server.use(
      http.get(`${API}/practice/activities/a1`, () => HttpResponse.json(envelope(full))),
      http.patch(`${API}/practice/activities/a1`, async ({ request }) => {
        patch = await request.json();
        return HttpResponse.json(envelope({ ...base, status: 'published' }));
      }),
    );
    const r = await render(ActivityBuilderPage, providers);
    r.fixture.componentRef.setInput('id', 'a1');
    await settle(r.fixture);
    expect(r.el.textContent).toContain('She ___ coffee');
    expect(r.el.textContent).toContain('Opción múltiple');
    getByRole(r.el, 'button', 'Publicar').click();
    await settle(r.fixture);
    expect(patch).toEqual({ status: 'published' });
  });

  it('agregar ítem inválido (opción correcta fuera de la lista) → aviso sin enviar', async () => {
    let posted = false;
    server.use(
      http.get(`${API}/practice/activities/a1`, () => HttpResponse.json(envelope(full))),
      http.post(`${API}/practice/activities/a1/items`, () => {
        posted = true;
        return HttpResponse.json(envelope({}), { status: 201 });
      }),
    );
    const r = await render(ActivityBuilderPage, providers);
    r.fixture.componentRef.setInput('id', 'a1');
    await settle(r.fixture);
    const forms = r.el.querySelectorAll('aula-practice-item-form');
    const add = forms[forms.length - 1] as HTMLElement;
    const set = (sel: string, v: string) => {
      const f = add.querySelectorAll('textarea')[Number(sel)] as HTMLTextAreaElement;
      f.value = v;
      f.dispatchEvent(new Event('input'));
    };
    set('0', 'Pick one');
    set('1', 'a\nb');
    set('2', 'c');
    await settle(r.fixture);
    getByRole(add, 'button', 'Agregar ejercicio').click();
    await settle(r.fixture);
    expect(getByRole(add, 'alert').textContent).toContain('una de las opciones');
    expect(posted).toBe(false);
  });
});
