import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AxiosError, AxiosHeaders } from 'axios';
import { of, throwError } from 'rxjs';
import {
  classifySpeechFailure,
  SpeechClient,
} from '../../../src/modules/games/infrastructure/ai/speech-client.adapter';
import { HttpExceptionFilter } from '../../../src/shared/filters/http-exception.filter';

// [Suite SpeechClient · 2026-10-25]: motivo del 503 (motor ausente / servicio caído / inferencia), 400 por audio inválido y WARN una sola vez | [Patrón]: Test Double (HttpService falso) + AAA

// [axiosError]: error real de axios (isAxiosError = true) con la respuesta de FastAPI | `AxiosHeaders` (axios 1.x): cabeceras tipadas
const axiosError = (status?: number, data?: unknown) =>
  new AxiosError(
    'Request failed',
    status ? 'ERR_BAD_RESPONSE' : 'ECONNREFUSED',
    undefined,
    undefined,
    status
      ? {
          status,
          statusText: '',
          data,
          headers: {},
          config: { headers: new AxiosHeaders() },
        }
      : undefined,
  );

const fail = (err: unknown) =>
  new SpeechClient({ post: jest.fn(() => throwError(() => err)) } as never);
const audio = Buffer.from('x');

describe('classifySpeechFailure', () => {
  it('distingue motor ausente, servicio caído, inferencia y audio inválido', () => {
    expect(
      classifySpeechFailure(
        axiosError(503, {
          code: 'SPEECH_ENGINE_MISSING',
          detail: "No module named 'faster_whisper'",
        }),
      ),
    ).toEqual({
      code: 'SPEECH_ENGINE_MISSING',
      status: 503,
      detail: "No module named 'faster_whisper'",
    });
    expect(classifySpeechFailure(axiosError()).code).toBe(
      'SPEECH_SERVICE_DOWN',
    );
    expect(
      classifySpeechFailure(
        axiosError(503, { code: 'MODEL_INFERENCE_ERROR', detail: 'OOM' }),
      ).code,
    ).toBe('SPEECH_INFERENCE_ERROR');
    expect(
      classifySpeechFailure(axiosError(422, { detail: ['file: required'] }))
        .code,
    ).toBe('BAD_AUDIO');
  });
});

describe('SpeechClient.transcribe', () => {
  it('503 con code y mensaje accionable cuando falta faster-whisper', async () => {
    const promise = fail(
      axiosError(503, { code: 'SPEECH_ENGINE_MISSING', detail: 'falta' }),
    ).transcribe(audio, 'audio/webm', 'en', 't');
    await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException);
    const body = (await promise.catch((e: ServiceUnavailableException) =>
      e.getResponse(),
    )) as Record<string, string>;
    expect(body.code).toBe('SPEECH_ENGINE_MISSING');
    expect(body.message).toMatch(/no está instalado/);
    expect(body.reason).toBe('falta'); // NODE_ENV=test → causa técnica visible para depurar
  });

  it('audio inválido → 400', async () => {
    await expect(
      fail(axiosError(422, { detail: 'Audio no válido' })).transcribe(
        audio,
        'audio/webm',
        'en',
        't',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('avisa (WARN) una sola vez por causa y de nuevo tras recuperarse', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const debug = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
    const post = jest.fn(() =>
      throwError(() =>
        axiosError(503, { code: 'SPEECH_ENGINE_MISSING', detail: 'falta' }),
      ),
    );
    const client = new SpeechClient({ post } as never);
    for (let i = 0; i < 3; i++)
      await client
        .transcribe(audio, 'audio/webm', 'en', 't')
        .catch(() => undefined);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledTimes(2);
    post.mockReturnValueOnce(
      of({
        data: {
          text: 'hi',
          language: 'en',
          duration: 1,
          words: [],
          model: 'm',
        },
      }) as never,
    );
    await client.transcribe(audio, 'audio/webm', 'en', 't');
    await client
      .transcribe(audio, 'audio/webm', 'en', 't')
      .catch(() => undefined);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
    debug.mockRestore();
  });
});

describe('HttpExceptionFilter con 503 esperable', () => {
  it('copia `code` al cuerpo y no registra ERROR con stack', () => {
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({
          url: '/api/v1/speech/transcribe',
          method: 'POST',
        }),
      }),
    };
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    new HttpExceptionFilter().catch(
      new ServiceUnavailableException({
        message: 'sin voz',
        code: 'SPEECH_ENGINE_MISSING',
      }),
      host as never,
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(json.mock.calls[0][0]).toMatchObject({
      statusCode: 503,
      message: 'sin voz',
      code: 'SPEECH_ENGINE_MISSING',
    });
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
