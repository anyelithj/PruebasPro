import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { API } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { SessionService } from '@core/auth/session.service';
// [Spec SessionService · onSessionExpired]: un 401 solo manda al login a quien tenía sesión; el visitante de /ayuda/faq o /verificar se queda | [Herramienta]: msw 2

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), SessionService] });
  const session = TestBed.inject(SessionService);
  const redirect = jest.spyOn(session, 'redirectToLogin').mockImplementation(() => undefined); // Sin navegar en jsdom
  return { session, redirect };
}

describe('SessionService.onSessionExpired', () => {
  it('anónimo (401 en /auth/me): no redirige', async () => {
    server.use(http.get(`${API}/auth/me`, () => HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })));
    const { session, redirect } = setup();
    expect(await session.load()).toBeNull();
    session.onSessionExpired();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('con sesión: redirige al login del shell', async () => {
    const { session, redirect } = setup(); // Handler por defecto: usuario ADMIN
    await session.load();
    session.onSessionExpired();
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});
