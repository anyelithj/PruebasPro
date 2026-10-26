import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { DialoguesFacade } from '@features/dialogues/application/dialogues.facade';
import { DialoguesRepository } from '@features/dialogues/domain/dialogues.repository.port';
import { DialoguesHttpRepository } from '@features/dialogues/infrastructure/dialogues.http-repository';
import AvatarConversationPage from '@features/dialogues/presentation/pages/avatar-conversation.page';
import { session, sessionAs, topic, turn } from '@testing/music-dialogues';
// [Spec AvatarConversationPage · Sprint 9.12]: objetivos y vocabulario antes de empezar → apertura del avatar con IPA y traducción → turno escrito por SSE con corrección suave bajo el turno → terminar; transcripción de una sesión anterior | [Herramienta]: render() + voz falsa + msw

const speech = { speak: jest.fn((_t: string, _l: string, _r: number, h: { end?: () => void } = {}) => h.end?.()), stop: jest.fn(), hasVoice: () => true, hasNaturalVoice: () => true, speaking: () => false, accent: () => 'uk', setAccent: jest.fn() };
const providers = [{ provide: DialoguesRepository, useClass: DialoguesHttpRepository }, DialoguesFacade, sessionAs('USER'), { provide: SpeechSynthesisService, useValue: speech }];
const sse = [
  `event: user\ndata: ${JSON.stringify(turn(1, 'user', 'I likes pasta', 'Se dice «I like».'))}\n\n`,
  `event: avatar\ndata: ${JSON.stringify({ ...turn(2, 'avatar', 'Pasta is great!'), vocabularyUsed: ['pasta'] })}\n\n`,
  'event: done\ndata: {}\n\n',
].join('');

describe('AvatarConversationPage', () => {
  it('empezar → apertura → turno escrito con corrección → terminar', async () => {
    let ended = false;
    server.use(
      http.get(`${API}/dialogues/topics`, () => HttpResponse.json(envelope([topic]))),
      http.post(`${API}/dialogues/sessions`, () => HttpResponse.json(envelope({ session: session(), topic, turns: [turn(0, 'avatar', 'What is your favourite food?')] }), { status: 201 })),
      http.post(`${API}/dialogues/sessions/ss1/turns/stream`, () => new HttpResponse(sse, { headers: { 'content-type': 'text/event-stream' } })),
      http.patch(`${API}/dialogues/sessions/ss1/end`, () => {
        ended = true;
        return HttpResponse.json(envelope(session({ status: 'ended' })));
      }),
    );
    const { fixture, el } = await render(AvatarConversationPage, providers);
    fixture.componentRef.setInput('topicId', 'tp1');
    await settle(fixture);
    expect(el.textContent).toContain('Di tu comida favorita'); // Objetivo visible antes de empezar
    expect(el.textContent).toContain('pasta');
    getByRole(el, 'button', 'Empezar a conversar').click();
    await settle(fixture);
    expect(el.textContent).toContain('What is your favourite food?');
    expect(el.textContent).toContain('trad 0');
    const input = el.querySelector<HTMLInputElement>('input[aria-label="Escribe lo que quieres decir…"]')!;
    input.value = 'I likes pasta';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);
    getByRole(el, 'button', 'Enviar').click();
    await settle(fixture);
    expect(el.textContent).toContain('Se dice «I like».');
    expect(el.textContent).toContain('✓ pasta');
    getByRole(el, 'button', 'Terminar').click();
    await settle(fixture);
    expect(ended).toBe(true);
    expect(el.textContent).toContain('Conversación terminada');
  });

  it('transcripción de una sesión anterior (solo lectura)', async () => {
    server.use(http.get(`${API}/dialogues/sessions/ss1`, () => HttpResponse.json(envelope({ ...session({ status: 'ended' }), turns: [turn(0, 'avatar', 'Hi!'), turn(1, 'user', 'Hello')] }))));
    const { fixture, el } = await render(AvatarConversationPage, providers);
    fixture.componentRef.setInput('id', 'ss1');
    await settle(fixture);
    expect(el.textContent).toContain('Hello');
    expect(el.querySelector('input[aria-label="Escribe lo que quieres decir…"]')).toBeNull();
  });
});
