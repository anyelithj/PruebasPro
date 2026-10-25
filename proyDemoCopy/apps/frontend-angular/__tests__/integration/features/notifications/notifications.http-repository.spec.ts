import { TestBed } from '@angular/core/testing';
import { firstValueFrom, take, toArray } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { FakeEventSource } from '@testing/fake-event-source';
import { testProviders } from '@testing/render';
import { ApiError } from '@core/http/error.interceptor';
import { NotificationsHttpRepository } from '@features/notifications/infrastructure/notifications.http-repository';
// [Spec NotificationsHttpRepository]: peticiones reales con msw (envelope de NestJS desenvuelto), errores traducidos a ApiError y mapeo SSE → modelo validado | [Herramienta]: msw 2 + FakeEventSource

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), NotificationsHttpRepository] });
  return TestBed.inject(NotificationsHttpRepository);
}

describe('NotificationsHttpRepository', () => {
  it('lee la bandeja desenvolviendo el envelope de NestJS', async () => {
    const inbox = await firstValueFrom(setup().inbox());
    expect(inbox.unread).toBe(1);
    expect(inbox.items[0]?.id).toBe('n1');
  });

  it('un 500 llega como ApiError con mensaje legible', async () => {
    server.use(http.get(`${API}/notifications/me`, () => HttpResponse.json({ message: 'Caído' }, { status: 500 })));
    await expect(firstValueFrom(setup().inbox())).rejects.toEqual(new ApiError(500, 'Caído'));
  });

  it('marca una como leída con el id codificado en la ruta', async () => {
    let path = '';
    server.use(http.patch(`${API}/notifications/:id/read`, ({ request }) => ((path = new URL(request.url).pathname), HttpResponse.json({}))));
    await firstValueFrom(setup().markRead('a/b'));
    expect(path).toBe('/api/notifications/a%2Fb/read');
  });

  it('live() valida los eventos SSE y descarta los inválidos', async () => {
    const got = firstValueFrom(setup().live().pipe(take(1), toArray()));
    const es = FakeEventSource.last('/notifications/stream');
    es.emit('notification', { id: 'x' }); // Inválido (faltan campos) → error del flujo
    await expect(got).rejects.toBeTruthy();
  });
});
