import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  INestApplication,
  NotFoundException,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsEmail } from 'class-validator';
import request from 'supertest';
import { HttpExceptionFilter } from '../../src/shared/filters/http-exception.filter';
import { GLOBAL_VALIDATION_OPTIONS } from '../../src/shared/pipes/validation.pipe';
// [Suite Usability – mensajes de error]: HttpExceptionFilter normaliza errores en {statusCode, message, timestamp, path, method} | [Por qué]: contrato uniforme para frontend (toasts, banners)

class PingDto {
  @IsEmail()
  email!: string;
}

@Controller('errs')
class ErrController {
  @Get('not-found')
  nf() {
    throw new NotFoundException('quiz 42 not found');
  }

  @Get('forbidden')
  fb() {
    throw new ForbiddenException();
  }

  @Get('boom')
  boom(): never {
    // [Error genérico]: el filter debe normalizarlo como 500 sin filtrar stack al cliente
    throw new Error('internal-leak');
  }

  @Post('validate')
  validate(@Body() _dto: PingDto) {
    return { ok: true };
  }

  @Get('bad-explicit')
  bad() {
    throw new BadRequestException({ message: ['campo X obligatorio', 'campo Y inválido'] });
  }
}

describe('Usability: shape de mensajes de error (HttpExceptionFilter)', () => {
  let app: INestApplication;
  let errSpy: jest.SpyInstance;

  beforeAll(async () => {
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const moduleRef = await Test.createTestingModule({ controllers: [ErrController] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_OPTIONS));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    errSpy.mockRestore();
  });

  it('NotFoundException → 404 envelope con path y method', async () => {
    const res = await request(app.getHttpServer()).get('/errs/not-found').expect(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      message: 'quiz 42 not found',
      path: '/errs/not-found',
      method: 'GET',
    });
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('ForbiddenException → 403 con mensaje default', async () => {
    const res = await request(app.getHttpServer()).get('/errs/forbidden').expect(403);
    expect(res.body.statusCode).toBe(403);
    expect(typeof res.body.message).toBe('string');
  });

  it('Error genérico → 500 sin exponer stack', async () => {
    const res = await request(app.getHttpServer()).get('/errs/boom').expect(500);
    expect(res.body.statusCode).toBe(500);
    expect(res.body.message).toBe('Internal server error');
    expect(JSON.stringify(res.body)).not.toMatch(/at Object|internal-leak/);
  });

  it('ValidationPipe falla → 400 con `message` array y propiedad descriptiva', async () => {
    const res = await request(app.getHttpServer())
      .post('/errs/validate')
      .send({ email: 'not-an-email' })
      .expect(400);
    expect(res.body.statusCode).toBe(400);
    expect(Array.isArray(res.body.message) ? res.body.message.join(' ') : res.body.message).toMatch(
      /email/i,
    );
  });

  it('BadRequestException con mensaje array conserva la lista', async () => {
    const res = await request(app.getHttpServer()).get('/errs/bad-explicit').expect(400);
    expect(res.body.message).toEqual(['campo X obligatorio', 'campo Y inválido']);
  });
});
