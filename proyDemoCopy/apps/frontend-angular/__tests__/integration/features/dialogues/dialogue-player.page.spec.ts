import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { DialoguesFacade } from '@features/dialogues/application/dialogues.facade';
import { DialoguesRepository } from '@features/dialogues/domain/dialogues.repository.port';
import { DialoguesHttpRepository } from '@features/dialogues/infrastructure/dialogues.http-repository';
import DialoguePlayerPage from '@features/dialogues/presentation/pages/dialogue-player.page';
import { dialogue, sessionAs, turn } from '@testing/music-dialogues';
// [Spec DialoguePlayerPage · Sprint 9.13]: elegir rol (radio), el avatar dice el turno del otro hablante y espera el del usuario; escribir la frase → coincidencia ≥ 70 % → siguiente; sin voz → aviso | [Herramienta]: render() + voz falsa + msw

const detail = { ...dialogue(), turns: [turn(0, 'A', 'Hello Tom'), turn(1, 'B', 'Hi Ana, how are you?'), turn(2, 'A', 'Fine, thanks')], editable: false, hasAudio: false };

async function open(hasVoice = true) {
  const speech = { speak: jest.fn((_t: string, _l: string, _r: number, h: { end?: () => void } = {}) => h.end?.()), stop: jest.fn(), hasVoice: () => hasVoice, speaking: () => false, accent: () => 'uk', setAccent: jest.fn() };
  server.use(http.get(`${API}/dialogues/d1`, () => HttpResponse.json(envelope(detail))));
  const r = await render(DialoguePlayerPage, [{ provide: DialoguesRepository, useClass: DialoguesHttpRepository }, DialoguesFacade, sessionAs('USER'), { provide: SpeechSynthesisService, useValue: speech }]);
  r.fixture.componentRef.setInput('id', 'd1');
  await settle(r.fixture);
  return { ...r, speech };
}

describe('DialoguePlayerPage', () => {
  it('como B: el avatar dice el turno de A y luego espera la frase del usuario', async () => {
    const { fixture, el, speech } = await open();
    getByRole(el, 'radio', 'Tom').click();
    await settle(fixture);
    getByRole(el, 'button', 'Practicar').click();
    await settle(fixture);
    expect(speech.speak).toHaveBeenCalledWith('Hello Tom', 'en', 0.9, expect.any(Object));
    expect(el.textContent).toContain('Tu turno');
    const input = el.querySelector<HTMLInputElement>('input[aria-label="O escribe la frase"]')!;
    input.value = 'hi ana how are you';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);
    getByRole(el, 'button', 'Comprobar').click();
    await settle(fixture);
    expect(el.textContent).toContain('100 % de coincidencia');
  });

  it('frase incompleta → «Inténtalo otra vez»; sin voz → aviso', async () => {
    const { fixture, el } = await open(false);
    expect(el.textContent).toContain('no tiene voz para este idioma');
    getByRole(el, 'button', 'Practicar').click(); // Rol A: el primer turno es del usuario
    await settle(fixture);
    const input = el.querySelector<HTMLInputElement>('input[aria-label="O escribe la frase"]')!;
    input.value = 'hello';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);
    getByRole(el, 'button', 'Comprobar').click();
    await settle(fixture);
    expect(el.textContent).toContain('Inténtalo otra vez');
  });
});
