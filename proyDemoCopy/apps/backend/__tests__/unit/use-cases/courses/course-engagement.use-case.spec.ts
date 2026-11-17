import { NotFoundException } from '@nestjs/common';
import { CourseEngagementUseCase } from '../../../../src/modules/courses/application/use-cases/course-engagement.use-case';
import type { ICourseRepository } from '../../../../src/modules/courses/domain/interfaces/course.repository.interface';
import { NO_ENGAGEMENT } from '../../../../src/modules/courses/domain/interfaces/course-engagement.repository.interface';
import { FakeEngagementRepo } from '../../../helpers/fake-engagement.repository';
// [Caso F · 2026-11-13]: reglas de ⭐ favorito y 👍/❤️ reacción | [Patrón]: Test Double (Fake en memoria que cumple el puerto) | [Principio]: probar el dominio sin BD

const COURSE = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ANA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LUIS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

// [courses]: solo existen COURSE y OTHER (cualquier otro id → 404)
const course = (id: string) => ({ id, title: id, slug: id, price: 0, originalPrice: null, currency: 'USD', rating: 0, createdAt: new Date(0), updatedAt: new Date(0) });
const courses = {
  findById: jest.fn(async (id: string) => ([COURSE, OTHER].includes(id) ? course(id) : null)),
  listEnrollmentsByUser: jest.fn(async () => []),
} as unknown as ICourseRepository;

describe('CourseEngagementUseCase (Caso F)', () => {
  let repo: FakeEngagementRepo;
  let uc: CourseEngagementUseCase;
  beforeEach(() => {
    repo = new FakeEngagementRepo();
    uc = new CourseEngagementUseCase(courses, repo);
  });

  it('⭐ favorito es idempotente: marcar dos veces deja uno; quitar dos veces no falla', async () => {
    await uc.setFavorite(ANA, COURSE, true);
    const twice = await uc.setFavorite(ANA, COURSE, true);
    expect(twice.isFavorite).toBe(true);
    expect(repo.favs.size).toBe(1);
    await uc.setFavorite(ANA, COURSE, false);
    expect((await uc.setFavorite(ANA, COURSE, false)).isFavorite).toBe(false);
  });

  it('👍 → ❤️ reemplaza la reacción (nunca ambas) y los conteos públicos cuadran', async () => {
    await uc.setReaction(ANA, COURSE, 'like');
    const s = await uc.setReaction(ANA, COURSE, 'love');
    expect(s).toMatchObject({ reaction: 'love', likesCount: 0, lovesCount: 1 });
    await uc.setReaction(LUIS, COURSE, 'like');
    expect((await uc.snapshot(null, [COURSE])).get(COURSE)).toMatchObject({ likesCount: 1, lovesCount: 1, reaction: null, isFavorite: false });
  });

  it('favorito independiente de la reacción: ⭐ + ❤️ a la vez, y quitar uno no toca el otro', async () => {
    await uc.setFavorite(ANA, COURSE, true);
    await uc.setReaction(ANA, COURSE, 'love');
    expect(await uc.setReaction(ANA, COURSE, null)).toMatchObject({ isFavorite: true, reaction: null });
    expect(await uc.setFavorite(ANA, COURSE, false)).toMatchObject({ isFavorite: false, reaction: null });
  });

  it('alias obsoleto toggle: pulsar la activa la quita, la otra la reemplaza, «favorite» alterna ⭐', async () => {
    expect((await uc.toggle(ANA, COURSE, 'like')).reaction).toBe('like');
    expect((await uc.toggle(ANA, COURSE, 'love')).reaction).toBe('love');
    expect((await uc.toggle(ANA, COURSE, 'love')).reaction).toBeNull();
    expect((await uc.toggle(ANA, COURSE, 'favorite')).isFavorite).toBe(true);
    expect((await uc.toggle(ANA, COURSE, 'favorite')).isFavorite).toBe(false);
  });

  it('curso inexistente → 404 sin escribir', async () => {
    await expect(uc.setFavorite(ANA, '99999999-9999-4999-8999-999999999999', true)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.favs.size).toBe(0);
  });

  it('visitante (sin sesión): solo conteos públicos, sin estado propio', async () => {
    await uc.setReaction(ANA, COURSE, 'like');
    expect((await uc.snapshot(null, [COURSE, OTHER])).get(OTHER)).toEqual({ courseId: OTHER, isFavorite: false, reaction: null, likesCount: 0, lovesCount: 0 });
    expect(NO_ENGAGEMENT).toEqual({ favorite: false, reaction: null });
  });

  it('«Mis favoritos»: paginado en el servidor, del más reciente al más antiguo, con el estado ⭐', async () => {
    await uc.setFavorite(ANA, COURSE, true);
    await uc.setFavorite(ANA, OTHER, true);
    const p1 = await uc.listFavorites(ANA, 1, 1);
    expect(p1).toMatchObject({ total: 2, page: 1, limit: 1 });
    expect(p1.data.map((c) => [c.id, c.isFavorite])).toEqual([[OTHER, true]]);
    expect((await uc.listFavorites(LUIS, 1, 12)).total).toBe(0); // Privado: cada usuario ve solo los suyos
  });

  it('[2026-11-16] «Mis favoritos» filtra también 👍 y ❤️ del usuario', async () => {
    await uc.setReaction(ANA, COURSE, 'like');
    await uc.setReaction(ANA, OTHER, 'love');
    await uc.setReaction(LUIS, OTHER, 'like');
    expect((await uc.listFavorites(ANA, 1, 12, 'like')).data.map((c) => c.id)).toEqual([COURSE]);
    expect((await uc.listFavorites(ANA, 1, 12, 'love')).data.map((c) => [c.id, c.reaction])).toEqual([[OTHER, 'love']]);
    expect((await uc.listFavorites(ANA, 1, 12)).total).toBe(0); // Sin ⭐
  });
});
