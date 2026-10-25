import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { http, HttpResponse } from 'msw';
import { API, envelope } from '@testing/msw/handlers';
import { server } from '@testing/msw/server';
import { testProviders } from '@testing/render';
import { ApiError } from '@core/http/error.interceptor';
import { ForumsHttpRepository } from '@features/forums/infrastructure/forums.http-repository';
// [Spec ForumsHttpRepository]: rutas de NestJS (lección → hilos, hilo → respuestas), cuerpos mínimos, PATCH de moderación y 403 → ApiError | [Herramienta]: msw 2

const thread = { id: 'th1', lessonId: 'l1', courseId: 'c1', authorId: 'u1', authorName: 'Ana', title: 'Duda de saludos', body: '¿?', status: 'open', pinned: false, postsCount: 0, lastPostAt: '2026-10-16T00:00:00Z', createdAt: '2026-10-16T00:00:00Z' };

function setup() {
  TestBed.configureTestingModule({ providers: [...testProviders(), ForumsHttpRepository] });
  return TestBed.inject(ForumsHttpRepository);
}

describe('ForumsHttpRepository', () => {
  it('GET hilos de la lección con su título', async () => {
    server.use(http.get(`${API}/forums/lessons/l1/threads`, () => HttpResponse.json(envelope({ lesson: { id: 'l1', courseId: 'c1', title: 'Saludos' }, items: [thread] }))));
    const r = await firstValueFrom(setup().threads('l1'));
    expect(r.lesson.title).toBe('Saludos');
    expect(r.items[0].title).toBe('Duda de saludos');
  });

  it('responder envía solo { body } y moderar usa PATCH', async () => {
    const seen: unknown[] = [];
    server.use(
      http.post(`${API}/forums/threads/th1/posts`, async ({ request }) => {
        seen.push(await request.json());
        return HttpResponse.json(envelope({ id: 'p1', threadId: 'th1', authorId: 'u2', authorName: 'Leo', body: 'Hola', editedAt: null, createdAt: '' }), { status: 201 });
      }),
      http.patch(`${API}/forums/threads/th1`, async ({ request }) => {
        seen.push(await request.json());
        return HttpResponse.json(envelope({ ...thread, pinned: true }));
      }),
    );
    const repo = setup();
    await firstValueFrom(repo.createPost('th1', 'Hola'));
    expect((await firstValueFrom(repo.updateThread('th1', { pinned: true }))).pinned).toBe(true);
    expect(seen).toEqual([{ body: 'Hola' }, { pinned: true }]);
  });

  it('sin inscripción → ApiError 403', async () => {
    server.use(http.get(`${API}/forums/lessons/l2/threads`, () => HttpResponse.json({ message: 'Inscríbete en el curso para participar en su foro' }, { status: 403 })));
    await expect(firstValueFrom(setup().threads('l2'))).rejects.toEqual(new ApiError(403, 'Inscríbete en el curso para participar en su foro'));
  });
});
