import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { FakeEventSource } from '@testing/fake-event-source';
import { render, settle } from '@testing/render';
import { expectAllNamed, getByRole } from '@testing/a11y';
import { NOTIFICATIONS_PROVIDERS } from '@features/notifications/notifications.providers';
import NotificationsPage from '@features/notifications/presentation/pages/notifications.page';
// [Spec NotificationsPage]: contenedor — carga, vacío, error, aviso en vivo y marcar leída | [Herramienta]: render() con HTTP real contra msw

describe('NotificationsPage', () => {
  it('muestra la bandeja y un aviso que llega en vivo', async () => {
    const { fixture, el } = await render(NotificationsPage, NOTIFICATIONS_PROVIDERS);
    expect(el.textContent).toContain('Hola');
    FakeEventSource.last('/notifications/stream').emit('notification', {
      id: 'n2',
      title: 'Reporte listo',
      body: 'Descárgalo',
      isRead: false,
      createdAt: '2026-10-15T11:00:00Z',
      payload: null,
    });
    await settle(fixture);
    expect(el.querySelectorAll('li').length).toBe(2);
    expectAllNamed(el);
  });

  it('marcar todas deja el contador en cero', async () => {
    const { fixture, el } = await render(NotificationsPage, NOTIFICATIONS_PROVIDERS);
    getByRole(el, 'button', 'Marcar todas').click();
    await settle(fixture);
    expect(el.textContent).toContain('0 sin leer');
  });

  it('estado vacío', async () => {
    server.use(http.get(`${API}/notifications/me`, () => HttpResponse.json(envelope({ items: [], unread: 0 }))));
    const { el } = await render(NotificationsPage, NOTIFICATIONS_PROVIDERS);
    expect(el.textContent).toContain('No tienes notificaciones');
  });

  it('error con botón Reintentar', async () => {
    server.use(http.get(`${API}/notifications/me`, () => HttpResponse.json({ message: 'Sin servicio' }, { status: 503 })));
    const { el } = await render(NotificationsPage, NOTIFICATIONS_PROVIDERS);
    expect(getByRole(el, 'alert').textContent).toContain('Sin servicio');
    getByRole(el, 'button', 'Reintentar');
  });
});
