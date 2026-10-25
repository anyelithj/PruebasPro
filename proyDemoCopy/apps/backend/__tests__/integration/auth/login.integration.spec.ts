import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
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
// [Suite Integration AuthController – login]: pipeline HTTP completo (pipe + filter + interceptor) con casos de uso mockeados

describe('AuthController POST /auth/login (integration)', () => {
  let app: INestApplication;
  let loginUC: { execute: jest.Mock };

  beforeAll(async () => {
    loginUC = { execute: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LoginUseCase, useValue: loginUC },
        { provide: RegisterUseCase, useValue: { execute: jest.fn() } },
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
    loginUC.execute.mockReset();
  });

  it('200 + envelope cuando las credenciales son válidas', async () => {
    loginUC.execute.mockResolvedValue({
      accessToken: 'acc',
      refreshToken: 'ref',
      accessExpiresIn: 900,
      tokenType: 'Bearer',
      user: { id: 'u1', email: 'a@b.io' },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.io', password: 'StrongP@ss123' })
      .expect(200);

    expect(res.body).toMatchObject({
      statusCode: 200,
      data: { accessToken: 'acc', user: { id: 'u1' } },
      meta: { path: '/auth/login' },
    });
    expect(loginUC.execute).toHaveBeenCalledWith(
      { email: 'a@b.io', password: 'StrongP@ss123' },
      expect.objectContaining({ ipAddress: expect.any(String) }),
    );
  });

  it('400 cuando el email es inválido (ValidationPipe)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'StrongP@ss123' })
      .expect(400);

    expect(res.body.statusCode).toBe(400);
    expect(loginUC.execute).not.toHaveBeenCalled();
  });

  it('400 cuando la password es demasiado corta', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.io', password: '123' })
      .expect(400);
    expect(loginUC.execute).not.toHaveBeenCalled();
  });

  it('400 cuando llegan propiedades no whitelisted (anti mass-assignment)', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.io', password: 'StrongP@ss123', role: 'ADMIN' })
      .expect(400);
  });

  it('401 cuando el use case lanza Unauthorized', async () => {
    loginUC.execute.mockRejectedValue(new UnauthorizedException('Invalid credentials'));
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@b.io', password: 'StrongP@ss123' })
      .expect(401);
    expect(res.body).toMatchObject({
      statusCode: 401,
      message: 'Invalid credentials',
      path: '/auth/login',
      method: 'POST',
    });
  });
});
