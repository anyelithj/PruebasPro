// [TDD] integración HTTP de auth — requiere Postgres (DATABASE_URL) + prisma migrate deploy.
// Corre con: npm run test:e2e  (levanta la app real con Prisma).
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from 'src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  const email = `e2e_${Date.now()}@test.dev`;

  it('registers, logs in and reads /me', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'E2E', email, password: 'supersecret' });
    expect(reg.status).toBe(201);
    expect(reg.body.data.accessToken).toBeTruthy();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'supersecret' });
    expect(login.status).toBe(200);
    const token = login.body.data.accessToken;

    const me = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);
  });

  it('rejects /me without token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/users/me');
    expect(res.status).toBe(401);
  });
});
