import { signal } from '@angular/core';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { render, settle } from '@testing/render';
import { getByRole } from '@testing/a11y';
import { SessionService } from '@core/auth/session.service';
import { ForumsFacade } from '@features/forums/application/forums.facade';
import { ForumsRepository } from '@features/forums/domain/forums.repository.port';
import { ForumsHttpRepository } from '@features/forums/infrastructure/forums.http-repository';
import ThreadsPage from '@features/forums/presentation/pages/threads.page';
// [Spec ThreadsPage]: lista de hilos con estados en texto, hilo con respuestas y moderación solo para docentes, hilo cerrado sin formulario, error 403 | [Herramienta]: render() + setInput + sesión falsa

const thread = { id: 'th1', lessonId: 'l1', courseId: 'c1', authorId: 'u1', authorName: 'Ana', title: 'Duda de saludos', body: '¿Bonjour o salut?', status: 'open', pinned: true, postsCount: 1, lastPostAt: '2026-10-16T00:00:00Z', createdAt: '2026-10-16T00:00:00Z' };
const post = { id: 'p1', threadId: 'th1', authorId: 'u2', authorName: 'Leo', body: 'Salut es informal', editedAt: null, createdAt: '2026-10-16T00:00:00Z' };
const providers = (id: string, role: 'USER' | 'TEACHER') => [
  { provide: ForumsRepository, useClass: ForumsHttpRepository },
  ForumsFacade,
  { provide: SessionService, useValue: { user: signal({ id }), role: signal(role), hasRole: (r: string) => r === role, isAuthenticated: signal(true) } },
];

async function open(input: 'lessonId' | 'id', value: string, id = 'u1', role: 'USER' | 'TEACHER' = 'USER') {
  const r = await render(ThreadsPage, providers(id, role));
  r.fixture.componentRef.setInput(input, value);
  await settle(r.fixture);
  return r;
}

describe('ThreadsPage', () => {
  it('lección: hilos con «Fijado» en texto, enlace al hilo y formulario para abrir uno', async () => {
    server.use(http.get(`${API}/forums/lessons/l1/threads`, () => HttpResponse.json(envelope({ lesson: { id: 'l1', courseId: 'c1', title: 'Saludos' }, items: [thread] }))));
    const { el } = await open('lessonId', 'l1');
    expect(el.querySelector('h1')?.textContent).toContain('Saludos');
    expect(el.textContent).toContain('Fijado');
    expect(el.querySelector('a[href="/foros/hilo/th1"]')).not.toBeNull();
    expect(el.textContent).toContain('Abrir un hilo');
  });

  it('hilo como estudiante autor: respuestas y retirar, pero sin botones de moderación', async () => {
    server.use(http.get(`${API}/forums/threads/th1/posts`, () => HttpResponse.json(envelope({ thread, items: [post] }))));
    const { el } = await open('id', 'th1');
    expect(el.textContent).toContain('Salut es informal');
    expect(el.textContent).toContain('Retirar hilo');
    expect(el.textContent).not.toContain('Cerrar hilo');
  });

  it('docente: modera; hilo cerrado oculta el formulario de respuesta', async () => {
    server.use(http.get(`${API}/forums/threads/th1/posts`, () => HttpResponse.json(envelope({ thread: { ...thread, status: 'closed' }, items: [] }))));
    const { el } = await open('id', 'th1', 't1', 'TEACHER');
    expect(el.textContent).toContain('Reabrir hilo');
    expect(el.textContent).toContain('ya no admite respuestas');
    expect(el.querySelector('textarea')).toBeNull();
  });

  it('sin inscripción → alerta', async () => {
    server.use(http.get(`${API}/forums/lessons/l2/threads`, () => HttpResponse.json({ message: 'Inscríbete en el curso para participar en su foro' }, { status: 403 })));
    const { el } = await open('lessonId', 'l2');
    expect(getByRole(el, 'alert').textContent).toContain('Inscríbete');
  });
});
