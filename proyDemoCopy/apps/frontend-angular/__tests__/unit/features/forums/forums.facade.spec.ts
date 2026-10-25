import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiError } from '@core/http/error.interceptor';
import { ForumsFacade } from '@features/forums/application/forums.facade';
import { ForumsRepository } from '@features/forums/domain/forums.repository.port';
import { canEdit, canModerate, canRemove } from '@features/forums/domain/models/forums';
// [Spec ForumsFacade]: responder relee el hilo, error del backend visible + políticas puras de permisos | [Patrón]: Test Double (repositorio falso)

const thread = { id: 'th1', lessonId: 'l1', authorId: 'u1', authorName: 'Ana', title: 'Duda', body: '¿?', status: 'open' as const, pinned: false, postsCount: 0, lastPostAt: '', createdAt: '' };

function setup(overrides: Partial<ForumsRepository> = {}) {
  const repo = {
    posts: jest.fn().mockReturnValueOnce(of({ thread, items: [] })).mockReturnValue(of({ thread: { ...thread, postsCount: 1 }, items: [{ id: 'p1' }] })),
    createPost: jest.fn(() => of({})),
    ...overrides,
  } as unknown as ForumsRepository;
  TestBed.configureTestingModule({ providers: [ForumsFacade, { provide: ForumsRepository, useValue: repo }] });
  return { facade: TestBed.inject(ForumsFacade), repo };
}

describe('ForumsFacade', () => {
  it('responder guarda y relee el hilo (contador real del backend)', async () => {
    const { facade, repo } = setup();
    await facade.loadThread('th1');
    expect(await facade.reply('th1', 'Respuesta')).toBe(true);
    expect(repo.createPost).toHaveBeenCalledWith('th1', 'Respuesta');
    expect(facade.thread.data()?.thread.postsCount).toBe(1);
  });

  it('hilo cerrado: el 409 del backend se muestra', async () => {
    const { facade } = setup({ createPost: () => throwError(() => new ApiError(409, 'El hilo está cerrado')) });
    expect(await facade.reply('th1', 'tarde')).toBe(false);
    expect(facade.actionError()).toContain('cerrado');
    expect(facade.busy()).toBe(false);
  });

  it('permisos: moderan docente/admin, edita el autor, retira autor o moderador', () => {
    const own = { authorId: 'u1' };
    expect(canModerate({ id: 't1', role: 'TEACHER' })).toBe(true);
    expect(canModerate({ id: 'u1', role: 'USER' })).toBe(false);
    expect(canEdit({ id: 'u1', role: 'USER' }, own)).toBe(true);
    expect(canEdit({ id: 't1', role: 'TEACHER' }, own)).toBe(false);
    expect(canRemove({ id: 'a1', role: 'ADMIN' }, own)).toBe(true);
    expect(canRemove({ id: 'u2', role: 'USER' }, own)).toBe(false);
  });
});
