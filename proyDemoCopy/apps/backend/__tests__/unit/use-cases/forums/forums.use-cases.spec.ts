import { CreatePostUseCase } from '../../../../src/modules/forums/application/use-cases/create-post.use-case';
import { CreateThreadUseCase } from '../../../../src/modules/forums/application/use-cases/create-thread.use-case';
import {
  ForumAccess,
  GetThreadUseCase,
} from '../../../../src/modules/forums/application/use-cases/list-threads.use-case';
import { ModerateThreadUseCase } from '../../../../src/modules/forums/application/use-cases/moderate-thread.use-case';
import type { ForumThread } from '../../../../src/modules/forums/domain/entities/forum-thread.entity';
import { Role } from '../../../../src/modules/users/domain/value-objects/role.vo';
// [Suite Forums · Sprint 7.14]: acceso por inscripción, hilo cerrado, aviso al autor (Observer) y permisos de moderación | [Patrón]: Test Double (puertos y repositorio en memoria) | [Herramienta]: Jest

const STUDENT = { id: 'u1', role: Role.USER };
const OTHER = { id: 'u2', role: Role.USER };
const TEACHER = { id: 't1', role: Role.TEACHER };

function setup(enrolled = true) {
  const rows: ForumThread[] = [];
  const threads = {
    create: jest.fn(
      (x: Partial<ForumThread>) => ({ id: 'th1', ...x }) as ForumThread,
    ),
    save: jest.fn(
      async (x: ForumThread) => (rows.includes(x) || rows.push(x), x),
    ),
    findOneBy: jest.fn(
      async ({ id }: { id: string }) => rows.find((r) => r.id === id) ?? null,
    ),
    softDelete: jest.fn(async () => undefined),
  };
  const access = new ForumAccess(
    {
      findLessonRef: jest.fn(async (id: string) =>
        id === 'l1' ? { id, courseId: 'c1', title: 'Saludos' } : null,
      ),
    } as never,
    {
      getEnrollment: jest.fn(async () =>
        enrolled ? { purchasedAt: new Date() } : null,
      ),
    } as never,
    {
      findById: jest.fn(async () => ({
        email: 'ana@aula.test',
        firstName: 'Ana',
        lastName: '',
      })),
    } as never,
  );
  const get = new GetThreadUseCase(threads as never, access);
  const notify = { execute: jest.fn(async () => undefined) };
  const tx = {
    save: jest.fn(async (p: object) => ({
      ...p,
      id: 'p1',
      createdAt: new Date(),
    })),
    increment: jest.fn(),
    update: jest.fn(),
  };
  const ds = {
    transaction: jest.fn(async (fn: (m: typeof tx) => unknown) => fn(tx)),
  };
  const posts = { create: jest.fn((x: object) => x) };
  return {
    rows,
    tx,
    notify,
    create: new CreateThreadUseCase(threads as never, access),
    reply: new CreatePostUseCase(
      posts as never,
      ds as never,
      get,
      access,
      notify as never,
    ),
    moderate: new ModerateThreadUseCase(threads as never, get),
  };
}

describe('Forums', () => {
  it('un estudiante sin inscripción no abre hilos; lección inexistente → 404', async () => {
    const s = setup(false);
    await expect(
      s.create.execute('l1', STUDENT, { title: 'Duda de saludos', body: '¿?' }),
    ).rejects.toThrow(/Inscríbete/);
    await expect(
      s.create.execute('nada', TEACHER, {
        title: 'Duda de saludos',
        body: '¿?',
      }),
    ).rejects.toThrow(/Lección/);
  });

  it('responder suma el contador en la transacción y avisa al autor del hilo (no a sí mismo)', async () => {
    const s = setup();
    const th = await s.create.execute('l1', STUDENT, {
      title: 'Duda de saludos',
      body: '¿Bonjour o salut?',
    });
    expect(th).toMatchObject({
      courseId: 'c1',
      authorName: 'Ana',
      status: 'open',
    });
    await s.reply.execute(th.id, OTHER, 'Salut es informal');
    expect(s.tx.increment).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'th1' },
      'postsCount',
      1,
    );
    expect(s.notify.execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', href: '/foros/hilo/th1' }),
    );
    await s.reply.execute(th.id, STUDENT, 'Gracias');
    expect(s.notify.execute).toHaveBeenCalledTimes(1);
  });

  it('moderación: solo docente/admin fija o cierra; en un hilo cerrado no se responde', async () => {
    const s = setup();
    const th = await s.create.execute('l1', STUDENT, {
      title: 'Duda de saludos',
      body: '¿?',
    });
    await expect(
      s.moderate.execute(th.id, STUDENT, { pinned: true }),
    ).rejects.toThrow(/modera/);
    await expect(
      s.moderate.execute(th.id, OTHER, { title: 'Otro título' }),
    ).rejects.toThrow(/autor/);
    await s.moderate.execute(th.id, TEACHER, {
      status: 'closed',
      pinned: true,
    });
    await expect(s.reply.execute(th.id, OTHER, 'tarde')).rejects.toThrow(
      /cerrado/,
    );
    await expect(s.moderate.remove(th.id, OTHER)).rejects.toThrow(/retirar/);
    expect(await s.moderate.remove(th.id, STUDENT)).toEqual({ removed: true }); // El autor sí
  });
});
