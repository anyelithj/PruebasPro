import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ProfileController } from '../../../src/modules/users/presentation/profile.controller';
import { GetProfileUseCase } from '../../../src/modules/users/application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from '../../../src/modules/users/application/use-cases/update-profile.use-case';
import { GetUserHistoryUseCase } from '../../../src/modules/users/application/use-cases/get-user-history.use-case';
import { DeleteAccountUseCase } from '../../../src/modules/users/application/use-cases/delete-account.use-case';
import { ChangePasswordUseCase } from '../../../src/modules/users/application/use-cases/change-password.use-case';
import { HttpExceptionFilter } from '../../../src/shared/filters/http-exception.filter';
import { TransformInterceptor } from '../../../src/shared/interceptors/transform.interceptor';
import { Role } from '../../../src/modules/users/domain/value-objects/role.vo';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { GLOBAL_VALIDATION_OPTIONS } from '../../../src/shared/pipes/validation.pipe';

// [Suite ProfileController]: GET/PATCH/DELETE /profile/me | [Patrón]: Controller Integration | [Principio]: SRP

describe('ProfileController (integration)', () => {
  let app: INestApplication;
  let getProfileUC: { execute: jest.Mock };
  let updateProfileUC: { execute: jest.Mock };
  let getHistoryUC: { execute: jest.Mock };
  let deleteAccountUC: { execute: jest.Mock };

  const mockUser = {
    id: 'u1',
    email: 'user@neuroedu.ia',
    firstName: 'Test',
    lastName: 'User',
    role: Role.USER,
    section: '11-1',
    isActive: true,
    createdAt: new Date('2025-01-01'),
  };

  beforeAll(async () => {
    getProfileUC = { execute: jest.fn() };
    updateProfileUC = { execute: jest.fn() };
    getHistoryUC = { execute: jest.fn() };
    deleteAccountUC = { execute: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        { provide: GetProfileUseCase, useValue: getProfileUC },
        { provide: UpdateProfileUseCase, useValue: updateProfileUC },
        { provide: GetUserHistoryUseCase, useValue: getHistoryUC },
        { provide: DeleteAccountUseCase, useValue: deleteAccountUC },
        // [Mock · DI NestJS]: el controlador también inyecta ChangePasswordUseCase (PATCH /profile/me/password) → doble vacío para que el módulo compile
        { provide: ChangePasswordUseCase, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_OPTIONS));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    // [Mock auth]: inyecta usuario autenticado en todas las rutas
    app.use((req: any, _res: any, next: any) => {
      req.user = { sub: 'u1', email: 'user@neuroedu.ia', role: Role.USER };
      next();
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===== GET /profile/me =====
  describe('GET /profile/me', () => {
    it('200 + envelope con perfil del usuario', async () => {
      getProfileUC.execute.mockResolvedValue(mockUser);
      const res = await request(app.getHttpServer())
        .get('/profile/me')
        .expect(200);

      expect(res.body).toMatchObject({
        statusCode: 200,
        data: {
          id: 'u1',
          email: 'user@neuroedu.ia',
          firstName: 'Test',
          role: Role.USER,
        },
        meta: { path: '/profile/me' },
      });
      expect(getProfileUC.execute).toHaveBeenCalledWith('u1');
    });

    it('404 cuando el usuario no existe', async () => {
      getProfileUC.execute.mockRejectedValue(new NotFoundException('User not found'));
      const res = await request(app.getHttpServer())
        .get('/profile/me')
        .expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        message: 'User not found',
      });
    });
  });

  // ===== GET /profile/me/history =====
  describe('GET /profile/me/history', () => {
    it('200 + perfil del historial', async () => {
      getHistoryUC.execute.mockResolvedValue(mockUser);
      const res = await request(app.getHttpServer())
        .get('/profile/me/history')
        .expect(200);

      expect(res.body).toMatchObject({
        statusCode: 200,
        data: { id: 'u1', email: 'user@neuroedu.ia' },
      });
      expect(getHistoryUC.execute).toHaveBeenCalledWith('u1');
    });

    it('404 si el usuario de historial no existe', async () => {
      getHistoryUC.execute.mockRejectedValue(new NotFoundException('User not found'));
      await request(app.getHttpServer())
        .get('/profile/me/history')
        .expect(404);
    });
  });

  // ===== PATCH /profile/me =====
  describe('PATCH /profile/me', () => {
    it('200 actualiza firstName y lastName', async () => {
      const updated = { ...mockUser, firstName: 'Carlos', lastName: 'López' };
      updateProfileUC.execute.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/profile/me')
        .send({ firstName: 'Carlos', lastName: 'López' })
        .expect(200);

      expect(res.body).toMatchObject({
        statusCode: 200,
        data: { firstName: 'Carlos', lastName: 'López' },
      });
      expect(updateProfileUC.execute).toHaveBeenCalledWith('u1', {
        firstName: 'Carlos',
        lastName: 'López',
      });
    });

    it('400 cuando envía campo que excede MaxLength', async () => {
      const res = await request(app.getHttpServer())
        .patch('/profile/me')
        .send({ firstName: 'a'.repeat(100) })
        .expect(400);

      expect(res.body).toMatchObject({ statusCode: 400 });
    });

    it('400 cuando envía campo no whitelisted (role)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/profile/me')
        .send({ role: 'ADMIN' })
        .expect(400);

      expect(res.body).toMatchObject({ statusCode: 400 });
    });

    it('404 si usuario no existe', async () => {
      updateProfileUC.execute.mockRejectedValue(new NotFoundException('User not found'));
      await request(app.getHttpServer())
        .patch('/profile/me')
        .send({ firstName: 'X' })
        .expect(404);
    });
  });

  // ===== DELETE /profile/me =====
  describe('DELETE /profile/me', () => {
    it('204 desactiva cuenta exitosamente', async () => {
      deleteAccountUC.execute.mockResolvedValue(undefined);
      await request(app.getHttpServer())
        .delete('/profile/me')
        .expect(204);
      expect(deleteAccountUC.execute).toHaveBeenCalledWith('u1');
    });

    it('404 si usuario no existe', async () => {
      deleteAccountUC.execute.mockRejectedValue(new NotFoundException('User not found'));
      await request(app.getHttpServer())
        .delete('/profile/me')
        .expect(404);
    });

    it('403 si ya está desactivado', async () => {
      deleteAccountUC.execute.mockRejectedValue(new ForbiddenException('Account already deactivated'));
      await request(app.getHttpServer())
        .delete('/profile/me')
        .expect(403);
    });
  });
});
