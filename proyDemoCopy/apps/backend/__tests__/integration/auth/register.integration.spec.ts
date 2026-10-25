import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../../../src/modules/auth/presentation/auth.controller';
import { LoginUseCase } from '../../../src/modules/auth/application/use-cases/login.use-case';
import { LogoutUseCase } from '../../../src/modules/auth/application/use-cases/logout.use-case';
import { OAuthLoginUseCase } from '../../../src/modules/auth/application/use-cases/oauth-login.use-case';
import { RefreshTokenUseCase } from '../../../src/modules/auth/application/use-cases/refresh-token.use-case';
import { RegisterUseCase } from '../../../src/modules/auth/application/use-cases/register.use-case';
import { RequestPasswordResetUseCase } from '../../../src/modules/auth/application/use-cases/request-password-reset.use-case';
import { RequestVerifyEmailUseCase } from '../../../src/modules/auth/application/use-cases/request-verify-email.use-case';
import { ResetPasswordUseCase } from '../../../src/modules/auth/application/use-cases/reset-password.use-case';
import { VerifyEmailUseCase } from '../../../src/modules/auth/application/use-cases/verify-email.use-case';
import { HttpExceptionFilter } from '../../../src/shared/filters/http-exception.filter';
import { TransformInterceptor } from '../../../src/shared/interceptors/transform.interceptor';
import { GLOBAL_VALIDATION_OPTIONS } from '../../../src/shared/pipes/validation.pipe';
// [Suite Integration AuthController – register]

describe('AuthController POST /auth/register (integration)', () => {
  let app: INestApplication;
  let registerUC: { execute: jest.Mock };

  const valid = {
    email: 'student@neuroedu.ia',
    password: 'StrongP@ss123',
    firstName: 'Juan',
    lastName: 'Andres',
  };

  beforeAll(async () => {
    registerUC = { execute: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: RegisterUseCase, useValue: registerUC },
        { provide: LoginUseCase, useValue: { execute: jest.fn() } },
        { provide: RefreshTokenUseCase, useValue: { execute: jest.fn() } },
        { provide: LogoutUseCase, useValue: { execute: jest.fn() } },
        { provide: VerifyEmailUseCase, useValue: { execute: jest.fn() } },
        { provide: RequestVerifyEmailUseCase, useValue: { execute: jest.fn() } },
        { provide: OAuthLoginUseCase, useValue: { execute: jest.fn() } },
        { provide: RequestPasswordResetUseCase, useValue: { execute: jest.fn() } },
        { provide: ResetPasswordUseCase, useValue: { execute: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_OPTIONS));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    registerUC.execute.mockReset();
  });

  it('201 + envelope cuando el payload es valido', async () => {
    registerUC.execute.mockResolvedValue({
      accessToken: 'acc',
      refreshToken: 'ref',
      tokenType: 'Bearer',
      accessExpiresIn: 900,
      user: { id: 'u1', email: valid.email },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(valid)
      .expect(201);

    expect(res.body).toMatchObject({
      statusCode: 201,
      data: { accessToken: 'acc', user: { id: 'u1' } },
      meta: { path: '/auth/register' },
    });
    expect(registerUC.execute).toHaveBeenCalledWith(
      expect.objectContaining({ email: valid.email }),
      expect.any(Object),
    );
  });

  it('400 si la password no cumple complejidad (sin mayuscula)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...valid, password: 'lowercase1' })
      .expect(400);
    expect(registerUC.execute).not.toHaveBeenCalled();
  });

  it('400 si falta firstName', async () => {
    const { firstName: _firstName, ...withoutFirstName } = valid;
    void _firstName;
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(withoutFirstName)
      .expect(400);
  });

  it('400 si role llega con un valor fuera del enum', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...valid, role: 'GODMODE' })
      .expect(400);
  });

  it('409 cuando el use case lanza ConflictException', async () => {
    registerUC.execute.mockRejectedValue(new ConflictException('Email already registered'));
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(valid)
      .expect(409);
    expect(res.body).toMatchObject({
      statusCode: 409,
      message: 'Email already registered',
      path: '/auth/register',
    });
  });
});
