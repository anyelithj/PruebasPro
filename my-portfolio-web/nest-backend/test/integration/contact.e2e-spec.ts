// [TDD] contact endpoint — POST público persiste el envío; la bandeja exige rol admin.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from 'src/app.module';

describe('Contact (e2e)', () => {
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

  it('submits the public form and stores it as pending', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contact')
      .send({
        name: 'Visitante',
        email: `visitor-${Date.now()}@example.com`,
        message: 'Hola, me interesa tu trabajo con NestJS.',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });

  it('rejects an invalid payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contact')
      .send({ name: 'X', email: 'not-an-email', message: 'corto' });

    expect(res.status).toBe(422);
  });

  it('hides the inbox from anonymous visitors', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/contact');
    expect(res.status).toBe(401);
  });
});
