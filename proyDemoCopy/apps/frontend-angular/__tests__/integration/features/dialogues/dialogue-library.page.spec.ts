import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { DialoguesFacade } from '@features/dialogues/application/dialogues.facade';
import { DialoguesRepository } from '@features/dialogues/domain/dialogues.repository.port';
import { DialoguesHttpRepository } from '@features/dialogues/infrastructure/dialogues.http-repository';
import DialogueLibraryPage from '@features/dialogues/presentation/pages/dialogue-library.page';
import { dialogue, sessionAs, topic } from '@testing/music-dialogues';
// [Spec DialogueLibraryPage · Sprint 9.11]: diálogos con nivel «confirmado» en texto (no solo color) y enlace para practicar; el ADMIN ve los pendientes «estimados»; vacío y error | [Herramienta]: render() + msw

const providers = (role: 'USER' | 'ADMIN') => [{ provide: DialoguesRepository, useClass: DialoguesHttpRepository }, DialoguesFacade, sessionAs(role)];

describe('DialogueLibraryPage', () => {
  it('estudiante: tarjeta con nivel confirmado y enlace al diálogo', async () => {
    server.use(http.get(`${API}/dialogues`, () => HttpResponse.json(envelope([dialogue()]))), http.get(`${API}/dialogues/topics`, () => HttpResponse.json(envelope([topic]))));
    const { el } = await render(DialogueLibraryPage, providers('USER'));
    expect(el.textContent).toContain('En el café');
    expect(el.textContent).toContain('A2 · confirmado');
    expect(el.querySelector('a[href="/dialogos/d1"]')).not.toBeNull();
    expect(el.textContent).not.toContain('Pendientes de confirmar');
  });

  it('ADMIN: pendientes con nivel «estimado»', async () => {
    server.use(
      http.get(`${API}/dialogues`, ({ request }) => {
        const p = new URL(request.url).searchParams;
        return HttpResponse.json(envelope(p.get('pending') ? [dialogue({ id: 'd2', title: 'Por revisar', levelStatus: 'estimated' })] : []));
      }),
      http.get(`${API}/dialogues/topics`, () => HttpResponse.json(envelope([]))),
    );
    const { el } = await render(DialogueLibraryPage, providers('ADMIN'));
    expect(el.textContent).toContain('Pendientes de confirmar');
    expect(el.textContent).toContain('A2 · estimado');
    expect(el.querySelector('a[href="/dialogos/subir/d2"]')).not.toBeNull();
  });

  it('error → alerta', async () => {
    server.use(http.get(`${API}/dialogues`, () => HttpResponse.json({ message: 'Caído' }, { status: 500 })), http.get(`${API}/dialogues/topics`, () => HttpResponse.json(envelope([]))));
    const { el } = await render(DialogueLibraryPage, providers('USER'));
    expect(getByRole(el, 'alert')).toBeTruthy();
  });
});
