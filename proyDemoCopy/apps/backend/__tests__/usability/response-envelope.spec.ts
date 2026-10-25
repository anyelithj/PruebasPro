import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TransformInterceptor } from '../../src/shared/interceptors/transform.interceptor';
// [Suite Usability – response envelope]: TransformInterceptor envuelve toda respuesta exitosa en { statusCode, data, meta:{timestamp,path} } | [Por qué]: contrato estable para frontend, doc en SSOT

@Controller('echo')
class EchoController {
  @Get()
  hello() {
    return { hello: 'world' };
  }

  @Post()
  list() {
    return [1, 2, 3];
  }
}

describe('Usability: response envelope (TransformInterceptor)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EchoController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('envuelve objetos en {statusCode, data, meta}', async () => {
    const res = await request(app.getHttpServer()).get('/echo').expect(200);
    expect(res.body).toMatchObject({
      statusCode: 200,
      data: { hello: 'world' },
      meta: { path: '/echo' },
    });
    expect(typeof res.body.meta.timestamp).toBe('string');
    expect(() => new Date(res.body.meta.timestamp).toISOString()).not.toThrow();
  });

  it('envuelve arrays preservando el orden', async () => {
    const res = await request(app.getHttpServer()).post('/echo').expect(201);
    expect(res.body.statusCode).toBe(201);
    expect(res.body.data).toEqual([1, 2, 3]);
  });

  it('meta.path refleja exactamente la URL solicitada (con querystring)', async () => {
    const res = await request(app.getHttpServer()).get('/echo?foo=1&bar=2').expect(200);
    expect(res.body.meta.path).toBe('/echo?foo=1&bar=2');
  });
});
