import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { DialoguesFacade } from '@features/dialogues/application/dialogues.facade';
import { DialoguesRepository } from '@features/dialogues/domain/dialogues.repository.port';
import { DialoguesHttpRepository } from '@features/dialogues/infrastructure/dialogues.http-repository';
import DialogueHubPage from '@features/dialogues/presentation/pages/dialogue-hub.page';
import { session, sessionAs, topic } from '@testing/music-dialogues';
// [Spec DialogueHubPage · Sprint 9.11]: temas con enlace a la conversación (idioma y nivel en la URL), historial con transcripción; crear tema solo docentes; vacío y error | [Herramienta]: render() + sesión falsa + msw

const providers = (role: 'USER' | 'TEACHER') => [{ provide: DialoguesRepository, useClass: DialoguesHttpRepository }, DialoguesFacade, sessionAs(role)];

describe('DialogueHubPage', () => {
  it('estudiante: temas con «Conversar», historial y sin crear temas', async () => {
    server.use(
      http.get(`${API}/dialogues/topics`, () => HttpResponse.json(envelope([topic]))),
      http.get(`${API}/dialogues/sessions/me`, () => HttpResponse.json(envelope([session({ userTurns: 3 })]))),
    );
    const { el } = await render(DialogueHubPage, providers('USER'));
    expect(el.textContent).toContain('Comida');
    const link = el.querySelector<HTMLAnchorElement>('a[href^="/dialogos/conversar/tp1"]')!;
    expect(link.getAttribute('href')).toContain('lang=en');
    expect(el.textContent).toContain('3 turnos');
    expect(el.querySelector('a[href="/dialogos/sesion/ss1"]')).not.toBeNull();
    expect(el.textContent).not.toContain('Nuevo tema');
  });

  it('docente ve «Nuevo tema» y «Subir diálogo»; sin temas → mensaje', async () => {
    server.use(http.get(`${API}/dialogues/topics`, () => HttpResponse.json(envelope([]))), http.get(`${API}/dialogues/sessions/me`, () => HttpResponse.json(envelope([]))));
    const { el } = await render(DialogueHubPage, providers('TEACHER'));
    expect(getByRole(el, 'button', 'Nuevo tema')).toBeTruthy();
    expect(el.querySelector('a[href="/dialogos/subir"]')).not.toBeNull();
    expect(el.textContent).toContain('No hay temas');
  });

  it('error → alerta', async () => {
    server.use(http.get(`${API}/dialogues/topics`, () => HttpResponse.json({ message: 'Caído' }, { status: 500 })), http.get(`${API}/dialogues/sessions/me`, () => HttpResponse.json(envelope([]))));
    const { el } = await render(DialogueHubPage, providers('USER'));
    expect(getByRole(el, 'alert')).toBeTruthy();
  });
});
