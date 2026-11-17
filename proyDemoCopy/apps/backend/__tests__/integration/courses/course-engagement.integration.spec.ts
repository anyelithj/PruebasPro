import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication, type InjectionToken } from '@nestjs/common';
import request from 'supertest';
import { CoursesController } from '../../../src/modules/courses/presentation/courses.controller';
import { MeFavoritesController } from '../../../src/modules/courses/presentation/me-favorites.controller';
import { CourseEngagementUseCase } from '../../../src/modules/courses/application/use-cases/course-engagement.use-case';
import { ListCoursesUseCase } from '../../../src/modules/courses/application/use-cases/list-courses.use-case';
import { AdminListCoursesUseCase } from '../../../src/modules/courses/application/use-cases/admin-list-courses.use-case';
import { GetCourseUseCase } from '../../../src/modules/courses/application/use-cases/get-course.use-case';
import { CreateCourseUseCase } from '../../../src/modules/courses/application/use-cases/create-course.use-case';
import { UpdateCourseUseCase } from '../../../src/modules/courses/application/use-cases/update-course.use-case';
import { DeleteCourseUseCase } from '../../../src/modules/courses/application/use-cases/delete-course.use-case';
import { SetPublishedUseCase } from '../../../src/modules/courses/application/use-cases/set-published.use-case';
import { PurchaseCourseUseCase } from '../../../src/modules/courses/application/use-cases/purchase-course.use-case';
import { DraftCourseUseCase } from '../../../src/modules/courses/application/use-cases/draft-course.use-case';
import { COURSE_REPOSITORY } from '../../../src/modules/courses/domain/interfaces/course.repository.interface';
import { COURSE_ENGAGEMENT_REPOSITORY } from '../../../src/modules/courses/domain/interfaces/course-engagement.repository.interface';
import { GLOBAL_VALIDATION_OPTIONS } from '../../../src/shared/pipes/validation.pipe';
import { FakeEngagementRepo } from '../../helpers/fake-engagement.repository';
// [Integración Caso F · 2026-11-13]: controladores REALES + ValidationPipe global + caso de uso REAL → contrato HTTP de ⭐ y 👍/❤️
// Solo la persistencia es un Fake (la migración se prueba aparte contra PostgreSQL) | [Patrón]: Test Double | el guard JWT se simula con un middleware (req.user)

const COURSE = '11111111-1111-4111-8111-111111111111';
const USER = '33333333-3333-4333-8333-333333333333';

describe('Favoritos y reacciones · endpoints (Caso F)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const course = { id: COURSE, title: 'Inglés A1', slug: 'ingles-a1', price: 0, originalPrice: null, currency: 'USD', rating: 0, createdAt: new Date(0), updatedAt: new Date(0) };
    const unused = (token: InjectionToken) => ({ provide: token, useValue: {} }); // Casos de uso que estas rutas no tocan
    const mod = await Test.createTestingModule({
      controllers: [CoursesController, MeFavoritesController],
      providers: [
        CourseEngagementUseCase,
        { provide: COURSE_ENGAGEMENT_REPOSITORY, useValue: new FakeEngagementRepo() },
        { provide: COURSE_REPOSITORY, useValue: { findById: async (id: string) => (id === COURSE ? course : null), listEnrollmentsByUser: async () => [] } },
        ...[ListCoursesUseCase, AdminListCoursesUseCase, GetCourseUseCase, CreateCourseUseCase, UpdateCourseUseCase, DeleteCourseUseCase, SetPublishedUseCase, PurchaseCourseUseCase, DraftCourseUseCase].map(unused),
      ],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_OPTIONS)); // Misma validación que main.ts
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { sub: USER, role: 'STUDENT' };
      next();
    });
    await app.init();
  });
  afterAll(() => app.close());

  it('PUT y DELETE …/favorite son idempotentes', async () => {
    for (let i = 0; i < 2; i++) expect((await http().put(`/courses/${COURSE}/favorite`)).body).toMatchObject({ isFavorite: true });
    for (let i = 0; i < 2; i++) expect((await http().delete(`/courses/${COURSE}/favorite`)).body).toMatchObject({ isFavorite: false });
  });

  it('PUT …/reaction reemplaza like por love y devuelve conteos; DELETE la quita', async () => {
    await http().put(`/courses/${COURSE}/reaction`).send({ type: 'like' }).expect(200);
    const love = await http().put(`/courses/${COURSE}/reaction`).send({ type: 'love' }).expect(200);
    expect(love.body).toEqual({ courseId: COURSE, isFavorite: false, reaction: 'love', likesCount: 0, lovesCount: 1 });
    expect((await http().delete(`/courses/${COURSE}/reaction`).expect(200)).body).toMatchObject({ reaction: null, lovesCount: 0 });
  });

  it('valida la entrada: tipo desconocido → 400; curso inexistente → 404; id no UUID → 400', async () => {
    await http().put(`/courses/${COURSE}/reaction`).send({ type: 'wow' }).expect(400);
    await http().post(`/courses/${COURSE}/reaction`).send({ kind: 'wow' }).expect(400); // Antes se trataba como «favorito»
    await http().put('/courses/99999999-9999-4999-8999-999999999999/favorite').expect(404);
    await http().put('/courses/no-es-uuid/favorite').expect(400);
  });

  it('alias obsoletos POST …/reaction y POST …/favorite usan el mismo caso de uso', async () => {
    expect((await http().post(`/courses/${COURSE}/reaction`).send({ kind: 'like' }).expect(200)).body.reaction).toBe('like');
    expect((await http().post(`/courses/${COURSE}/reaction`).send({ kind: 'like' }).expect(200)).body.reaction).toBeNull();
    expect((await http().post(`/courses/${COURSE}/favorite`).expect(200)).body.isFavorite).toBe(true);
  });

  it('GET /me/favorites pagina en el servidor y valida el tope', async () => {
    const res = await http().get('/me/favorites?page=1&limit=12').expect(200);
    expect(res.body).toMatchObject({ total: 1, page: 1, limit: 12 });
    expect(res.body.data[0]).toMatchObject({ id: COURSE, isFavorite: true });
    await http().get('/me/favorites?limit=500').expect(400);
  });
});
