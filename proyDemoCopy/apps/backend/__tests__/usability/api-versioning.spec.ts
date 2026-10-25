import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
// [Suite Usability – versionado de API]: confirma que setGlobalPrefix('api/v1') aísla las rutas y que requests sin prefijo devuelven 404. [Por qué]: la convención `/api/v1/*` es contrato público con el frontend y no debe romperse sin coordinar.

@Controller('ping')
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

describe('Usability: versionado de API (global prefix /api/v1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [PingController] }).compile();
    app = moduleRef.createNestApplication();
    // [Mismo prefix que main.ts]: SSOT del versionado
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/ping responde 200', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/ping').expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('GET /ping (sin prefijo) responde 404', async () => {
    await request(app.getHttpServer()).get('/ping').expect(404);
  });

  it('GET /api/v2/ping (versión inexistente) responde 404', async () => {
    await request(app.getHttpServer()).get('/api/v2/ping').expect(404);
  });
});
