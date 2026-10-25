import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { ActivityBuilderFacade } from '@features/practice/application/activity-builder.facade';
import { PracticeFacade } from '@features/practice/application/practice.facade';
import { PracticeRepository } from '@features/practice/domain/practice.repository.port';
import { PracticeHttpRepository } from '@features/practice/infrastructure/practice.http-repository';
import PracticePlayerPage from '@features/practice/presentation/pages/practice-player.page';
// [Spec PracticePlayerPage · Sprint 8.14]: marcador (cada palabra = botón aria-pressed) → comprobar → panel debajo con error, corrección (<del>/<ins>), respuesta correcta y consejo → resultado | [Herramienta]: render() + setInput + msw

const providers = [{ provide: PracticeRepository, useClass: PracticeHttpRepository }, PracticeFacade, ActivityBuilderFacade];
const activity = { id: 'a1', title: 'Presente simple', description: '', language: 'en', level: 'A2', skill: 'grammar', status: 'published', aiDraft: false, createdBy: 't1', items: [{ id: 'i1', position: 0, itemType: 'mark_errors', skill: 'grammar', prompt: 'She go to school', options: [] }] };
const feedback = { correct: false, score: 0.5, findings: [{ type: 'grammar', original: 'go', correction: 'goes', explanation_es: 'Tercera persona del singular: añade -s.', start: 4, end: 6 }], correct_answer: 'She goes to school', explanation: 'Con he/she/it el verbo lleva -s.', tip: 'Busca el sujeto antes del verbo.', method: 'deterministic' };

async function open() {
  const r = await render(PracticePlayerPage, providers);
  r.fixture.componentRef.setInput('activityId', 'a1');
  await settle(r.fixture);
  return r;
}

describe('PracticePlayerPage', () => {
  it('marcar → comprobar → corrección debajo → resultado final', async () => {
    let body: unknown;
    server.use(
      http.get(`${API}/practice/activities/a1`, () => HttpResponse.json(envelope(activity))),
      http.post(`${API}/practice/attempts`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope({ id: 'at', itemId: 'i1', activityId: 'a1', answer: ['1'], correct: false, score: '0.50', feedback, createdAt: '' }), { status: 201 });
      }),
    );
    const { fixture, el } = await open();
    expect(el.textContent).toContain('Ejercicio 1 de 1');
    const word = getByRole(el, 'button', 'go');
    word.click();
    await settle(fixture);
    expect(word.getAttribute('aria-pressed')).toBe('true');
    getByRole(el, 'button', 'Comprobar').click();
    await settle(fixture);
    expect(body).toEqual({ itemId: 'i1', answer: ['1'] });
    expect(el.querySelector('del')?.textContent).toContain('go');
    expect(el.querySelector('ins')?.textContent).toContain('goes');
    expect(el.textContent).toContain('Casi: 50 %');
    expect(el.textContent).toContain('She goes to school');
    expect(el.textContent).toContain('Busca el sujeto');
    getByRole(el, 'button', 'Ver resultado').click();
    await settle(fixture);
    expect(el.textContent).toContain('Acertaste el 50 %');
    expect(el.textContent).toContain('Errores más frecuentes');
    expect(el.textContent).toContain('× 1'); // Un error de gramática en la sesión
  });

  it('actividad no disponible → alerta', async () => {
    server.use(http.get(`${API}/practice/activities/a1`, () => HttpResponse.json({ message: 'Actividad no encontrada' }, { status: 404 })));
    const { el } = await open();
    expect(getByRole(el, 'alert').textContent).toContain('no encontrada');
  });
});
