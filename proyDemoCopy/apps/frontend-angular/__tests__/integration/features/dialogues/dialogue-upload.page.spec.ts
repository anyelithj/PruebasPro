import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { DialoguesFacade } from '@features/dialogues/application/dialogues.facade';
import { DialoguesRepository } from '@features/dialogues/domain/dialogues.repository.port';
import { DialoguesHttpRepository } from '@features/dialogues/infrastructure/dialogues.http-repository';
import DialogueUploadPage from '@features/dialogues/presentation/pages/dialogue-upload.page';
import { dialogue, sessionAs, topic, turn } from '@testing/music-dialogues';
// [Spec DialogueUploadPage · Sprint 9.13]: formulario sin licencia → no se guarda; diálogo con nivel estimado → indicadores y «Confirmar nivel» → confirmado | [Herramienta]: render() + setInput + msw

const providers = [{ provide: DialoguesRepository, useClass: DialoguesHttpRepository }, DialoguesFacade, sessionAs('TEACHER')];

describe('DialogueUploadPage', () => {
  it('nuevo: sin turnos de los dos hablantes ni licencia no se envía y los obligatorios quedan marcados', async () => {
    let posted = false;
    server.use(
      http.get(`${API}/dialogues/topics`, () => HttpResponse.json(envelope([topic]))),
      http.post(`${API}/dialogues`, () => ((posted = true), HttpResponse.json(envelope({})))),
    );
    const { el, fixture } = await render(DialogueUploadPage, providers);
    // [2026-10-19]: el botón ya no se deshabilita: al pulsarlo se marcan los obligatorios (data-tried) y no se envía nada
    (getByRole(el, 'button', 'Guardar y estimar') as HTMLButtonElement).click();
    await settle(fixture);
    expect(posted).toBe(false);
    expect(el.querySelector('form')?.hasAttribute('data-tried')).toBe(true);
    expect(el.textContent).toContain('turnos de los dos hablantes');
    expect(el.textContent).not.toContain('🍝 Comida'); // [2026-10-20]: el tema opcional solo aparece si se relaciona con el título (aún vacío)
  });

  it('nivel estimado con indicadores → confirmar → «confirmado»', async () => {
    let body: unknown;
    const estimated = { ...dialogue({ levelStatus: 'estimated' }), turns: [turn(0, 'A', 'Hello'), turn(1, 'B', 'Hi')], editable: true, hasAudio: false };
    server.use(
      http.get(`${API}/dialogues/topics`, () => HttpResponse.json(envelope([]))),
      http.get(`${API}/dialogues/d1`, () => HttpResponse.json(envelope(estimated))),
      http.patch(`${API}/dialogues/d1/level`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(envelope(dialogue({ level: 'A2', levelStatus: 'confirmed' })));
      }),
    );
    const { fixture, el } = await render(DialogueUploadPage, providers);
    fixture.componentRef.setInput('id', 'd1');
    await settle(fixture);
    expect(el.textContent).toContain('Nivel estimado: A2 (confianza 80 %)');
    expect(el.textContent).toContain('Palabras por oración');
    getByRole(el, 'button', 'Confirmar nivel').click();
    await settle(fixture);
    expect(body).toEqual({ level: 'A2' });
    expect(el.textContent).toContain('A2 · confirmado');
  });
});
