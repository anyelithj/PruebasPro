import { HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { TopicTitleUseCase } from '../../../../src/modules/vocabulary/application/use-cases/topic-title.use-case';
import { translateKnownError } from '../../../../src/shared/filters/http-exception.filter';
import { validateCurriculumContent } from '../../../../src/modules/curriculum/domain/content/curriculum-content.schema';
import { CurriculumItemKind } from '../../../../src/modules/curriculum/domain/value-objects/curriculum-item-kind.vo';
import type { LanguageToolsPort } from '../../../../src/shared/domain/interfaces/language-tools.interface';
// [Suite correcciones 2026-10-27]: título de tema Fail Soft (servicio de idiomas caído → 200 sin IPA), errores de PostgreSQL → 4xx legibles y texto
// importado con caracteres que PostgreSQL rechaza (antes 500 «Internal server error» al guardar recursos) | [Patrón]: Test Double | [Herramienta]: Jest

const pgError = (code: string, column?: string) =>
  Object.assign(new QueryFailedError('INSERT …', [], new Error('pg')), { driverError: { code, column } });

describe('Correcciones 2026-10-27', () => {
  it('servicio interno sin conexión (ECONNREFUSED) → 503 legible, no 500', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5433'), { code: 'ECONNREFUSED' });
    expect(translateKnownError(err)?.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('título del tema: si la traducción falla devuelve el tema sin IPA (no 503) y no lo cachea', async () => {
    const tools = {
      translate: jest.fn(async () => Promise.reject(new ServiceUnavailableException())),
      ipa: jest.fn(),
    } as unknown as LanguageToolsPort;
    const uc = new TopicTitleUseCase(tools);
    await expect(uc.execute('La familia', 'en', 't')).resolves.toEqual({ text: 'La familia', ipa: null, ipaUs: null, translationEs: 'La familia', translated: false });
    expect(tools.ipa).not.toHaveBeenCalled(); // IPA inglesa de un texto español sería falsa
    await uc.execute('La familia', 'en', 't');
    expect(tools.translate).toHaveBeenCalledTimes(2); // Sin caché del fallo → reintenta
  });

  it('título del tema: traducción vacía («unavailable») también degrada sin IPA', async () => {
    const tools = { translate: jest.fn(async () => ({ translation: '' })), ipa: jest.fn() } as unknown as LanguageToolsPort;
    await expect(new TopicTitleUseCase(tools).execute('La casa', 'fr', 't')).resolves.toMatchObject({ text: 'La casa', ipa: null, translated: false });
  });

  it('título del tema: traducción OK pero IPA caída → 200 con la traducción, ipa null y sin caché', async () => {
    const tools = {
      translate: jest.fn(async () => ({ translation: 'The house' })),
      ipa: jest.fn(async () => Promise.reject(new ServiceUnavailableException())),
    } as unknown as LanguageToolsPort;
    const uc = new TopicTitleUseCase(tools);
    await expect(uc.execute('La casa', 'en', 't')).resolves.toEqual({ text: 'The house', ipa: null, ipaUs: null, translationEs: 'La casa', translated: true });
    await uc.execute('La casa', 'en', 't');
    expect(tools.translate).toHaveBeenCalledTimes(2); // Incompleto → no se cachea
  });

  it('título del tema: un throw SÍNCRONO del adaptador también degrada (nunca 503)', async () => {
    const tools = { translate: jest.fn(() => { throw new ServiceUnavailableException(); }), ipa: jest.fn() } as unknown as LanguageToolsPort;
    await expect(new TopicTitleUseCase(tools).execute('El tiempo', 'de', 't')).resolves.toMatchObject({ text: 'El tiempo', ipa: null, translated: false });
  });

  it('título del tema: peticiones simultáneas comparten una sola llamada (single-flight)', async () => {
    const tools = {
      translate: jest.fn(async () => ({ translation: 'The family' })),
      ipa: jest.fn(async () => ({ ipa: 'ðə ˈfæmɪli', ipa_us: null, engine: 'espeak-ng' })),
    } as unknown as LanguageToolsPort;
    const uc = new TopicTitleUseCase(tools);
    const [a, b] = await Promise.all([uc.execute('La familia', 'en', 't'), uc.execute('la familia', 'en', 't')]);
    expect(a).toEqual(b);
    expect(tools.translate).toHaveBeenCalledTimes(1);
  });

  it('título del tema: FastAPI colgado → responde sin traducción al vencer el plazo', async () => {
    jest.useFakeTimers();
    try {
      const tools = { translate: jest.fn(() => new Promise(() => undefined)), ipa: jest.fn() } as unknown as LanguageToolsPort;
      const pending = new TopicTitleUseCase(tools).execute('La escuela', 'en', 't');
      await jest.advanceTimersByTimeAsync(8_000);
      await expect(pending).resolves.toMatchObject({ text: 'La escuela', translated: false });
    } finally {
      jest.useRealTimers();
    }
  });

  it('errores de PostgreSQL conocidos → HttpException 4xx con mensaje y código; desconocidos → null (500)', () => {
    const tooLong = translateKnownError(pgError('22001', 'key'))!;
    expect(tooLong).toBeInstanceOf(HttpException);
    expect(tooLong.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(tooLong.getResponse()).toMatchObject({ code: 'DB_22001', message: expect.stringContaining('(key)') });
    expect(translateKnownError(pgError('23505'))!.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(translateKnownError(pgError('42703'))!.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR); // Migración pendiente: 500 pero con mensaje claro
    expect(translateKnownError(pgError('XX000'))).toBeNull();
    expect(translateKnownError(Object.assign(new Error('too big'), { status: 413, type: 'entity.too.large' }))!.getStatus()).toBe(413);
    expect(translateKnownError(new Error('boom'))).toBeNull();
  });

  it('contenido: quita el carácter nulo y los surrogates sueltos antes de validar (PostgreSQL los rechaza en JSONB)', () => {
    const r = validateCurriculumContent(CurriculumItemKind.EXAMPLE, { text: 'Hello\u0000 world \uD83D', translationEs: 'Hola mundo' });
    expect(r).toEqual({ ok: true, content: { text: 'Hello world', translationEs: 'Hola mundo' } });
    const ex = validateCurriculumContent(CurriculumItemKind.EXERCISE, { prompt: 'Pick\u0000', type: 'multiple_choice', options: ['go\u0000', 'goes'], answerKey: ['go'] });
    expect(ex.ok).toBe(true); // La clave sigue dentro de las opciones tras limpiar
  });
});
