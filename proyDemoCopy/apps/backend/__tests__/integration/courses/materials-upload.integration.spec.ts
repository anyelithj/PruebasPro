import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import request from 'supertest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CourseMaterialsController } from '../../../src/modules/courses/presentation/course-materials.controller';
import { CourseMaterialsUseCase } from '../../../src/modules/courses/application/use-cases/course-materials.use-case';
// [Integración subida de materiales]: controller real + multer real a disco → verifica que PDF, imagen y video pasan el filtro | [Patrón]: Test Double (use case espía)

describe('POST /courses/:id/materials (multer real)', () => {
  let app: INestApplication;
  const upload = jest.fn((_c: string, file: { mimetype: string; originalname: string }) => Promise.resolve({ mimetype: file.mimetype, name: file.originalname }));

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [MulterModule.register({ dest: join(tmpdir(), 'qa-uploads-int') })],
      controllers: [CourseMaterialsController],
      providers: [{ provide: CourseMaterialsUseCase, useValue: { upload } }],
    }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  const course = '11111111-1111-4111-8111-111111111111';
  it.each([
    ['guia.pdf', 'application/pdf'],
    ['guia.pdf', 'application/octet-stream'], // Navegador sin tipo → se deduce por extensión
    ['foto.png', 'image/png'],
    ['foto.JPG', 'application/octet-stream'], // Imagen sin tipo → por extensión
    ['clase.mp4', 'video/mp4'],
  ])('acepta %s (%s)', async (name, type) => {
    const res = await request(app.getHttpServer())
      .post(`/courses/${course}/materials`)
      .field('title', 'x')
      .attach('file', Buffer.from('%PDF-1.4 demo'), { filename: name, contentType: type });
    expect(res.status).toBe(201);
  });

  it('rechaza ejecutables', async () => {
    const res = await request(app.getHttpServer())
      .post(`/courses/${course}/materials`)
      .attach('file', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
  });
});
