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
// [Suite Integration AuthController – refresh]

// [JWT de prueba]: forma valida (3 segmentos base64url) → pasa @IsJWT
const FAKE_JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSIsInR5cCI6InJlZnJlc2gifQ.signaturepart-XYZ';

describe('AuthController POST /auth/refresh (integration)', () => {
  let app: INestApplication;
  let refreshUC: { execute: jest.Mock };

  beforeAll(async () => {
    refreshUC = { execute: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: RefreshTokenUseCase, useValue: refreshUC },
        { provide: LoginUseCase, useValue: { execute: jest.fn() } },
        { provide: RegisterUseCase, useValue: { execute: jest.fn() } },
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
    refreshUC.execute.mockReset();
  });

  it('200 + envelope rota el par de tokens', async () => {
    refreshUC.execute.mockResolvedValue({
      accessToken: 'acc2',
      refreshToken: 'ref2',
      tokenType: 'Bearer',
      accessExpiresIn: 900,
      user: { id: 'u1' },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: FAKE_JWT })
      .expect(200);

    expect(res.body).toMatchObject({
      statusCode: 200,
      data: { accessToken: 'acc2', refreshToken: 'ref2' },
    });
    expect(refreshUC.execute).toHaveBeenCalledWith(
      { refreshToken: FAKE_JWT },
      expect.any(Object),
    );
  });

  it('400 si el refreshToken no es un JWT bien formado', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'not-a-jwt' })
      .expect(400);
    expect(refreshUC.execute).not.toHaveBeenCalled();
  });

  it('400 si falta refreshToken', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({})
      .expect(400);
  });

  it('401 cuando el use case lanza Unauthorized (token revocado/expirado)', async () => {
    refreshUC.execute.mockRejectedValue(new UnauthorizedException('Refresh expired'));
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: FAKE_JWT })
      .expect(401);
    expect(res.body).toMatchObject({ statusCode: 401, message: 'Refresh expired' });
  });
});
