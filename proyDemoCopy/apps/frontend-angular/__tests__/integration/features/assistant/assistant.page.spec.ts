import { of, throwError } from 'rxjs';
import { render, settle } from '@testing/render';
import { expectAllNamed, getByRole } from '@testing/a11y';
import { AssistantFacade } from '@features/assistant/application/assistant.facade';
import { AssistantRepository } from '@features/assistant/domain/assistant.repository.port';
import type { ChatChunk } from '@features/assistant/domain/models/assistant';
import AssistantPage from '@features/assistant/presentation/pages/assistant.page';
// [Spec AssistantPage]: contenedor — vacío, enviar con Enter, respuesta del tutor y error | [Patrón]: Test Double del puerto (sin HTTP)

// [2026-10-28]: la página carga «Mis conversaciones» al iniciar → el doble también responde `list`
const providers = (stream: AssistantRepository['stream']) => [AssistantFacade, { provide: AssistantRepository, useValue: { stream, list: () => of([]) } }];

async function type(el: HTMLElement, text: string) {
  const area = el.querySelector('textarea')!;
  area.value = text;
  area.dispatchEvent(new Event('input'));
  return area;
}

describe('AssistantPage', () => {
  it('estado vacío (saludo del tutor, meta del nivel); Enter envía y aparece la respuesta del tutor', async () => {
    const chunks: ChatChunk[] = [{ type: 'token', text: 'Present perfect = have + participio' }, { type: 'done' }];
    const { fixture, el } = await render(AssistantPage, providers(() => of(...chunks)));
    expect(getByRole(el, 'log').textContent).toContain('¿En qué te puedo ayudar hoy?');
    expect(el.textContent).toContain('Aún no tienes conversaciones guardadas');
    expect(el.textContent).toContain('0 % / meta 40 %'); // Nivel A2 por defecto
    const area = await type(el, '¿Present perfect?');
    await settle(fixture);
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await settle(fixture);
    const log = getByRole(el, 'log');
    expect(log.textContent).toContain('¿Present perfect?');
    expect(log.textContent).toContain('have + participio');
    expect(area.value).toBe('');
    expectAllNamed(el);
  });

  it('muestra el error del servicio', async () => {
    const { fixture, el } = await render(AssistantPage, providers(() => throwError(() => new Error('El tutor no está disponible'))));
    await type(el, 'Hola');
    await settle(fixture);
    getByRole(el, 'button', 'Enviar').click();
    await settle(fixture);
    expect(getByRole(el, 'alert').textContent).toContain('El tutor no está disponible');
  });
});
