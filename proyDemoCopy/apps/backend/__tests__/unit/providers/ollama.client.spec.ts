import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { OllamaClient } from '../../../src/modules/ai/ollama.client';

// [Suite OllamaClient]: único cliente de Ollama del backend → payload común, traducción de errores y memo de /api/show | [Patrón]: Test Double (HttpService falso) | [Principio]: DRY (una sola política probada una vez)

// [Config falsa]: devuelve siempre el valor por defecto | `as never` (TS): basta con la forma usada por la clase
const config = { get: (_k: string, d?: unknown) => d } as never;

// [Fábrica de cliente]: `jest.fn()` registra llamadas para verificar URL y cuerpo enviados
const makeClient = (post: jest.Mock, get: jest.Mock = jest.fn()) => new OllamaClient({ post, get } as never, config);

describe('OllamaClient', () => {
  it('envía JSON restringido, keep_alive y think:false solo para Qwen3', async () => {
    const post = jest.fn().mockReturnValue(of({ data: { response: '{}' } }));
    const client = makeClient(post);
    await client.generate({ model: 'qwen3:8b', prompt: 'p', options: { temperature: 0.3, num_predict: 10, num_ctx: 100 } });
    await client.generate({ model: 'aya-expanse:8b', prompt: 'p', options: { temperature: 0.3, num_predict: 10, num_ctx: 100 } });
    const [url, qwenBody] = post.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/generate');
    expect(qwenBody).toMatchObject({ format: 'json', stream: false, keep_alive: '5m', think: false });
    expect(post.mock.calls[1][1]).not.toHaveProperty('think'); // Aya no admite el campo
  });

  it('traduce 404 en una pista para instalar el modelo', async () => {
    const post = jest.fn().mockReturnValue(throwError(() => ({ response: { status: 404, data: { error: 'not found' } } })));
    const promise = makeClient(post).generate({ model: 'm:1', prompt: 'p', options: { temperature: 0, num_predict: 1, num_ctx: 1 } });
    await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(promise).rejects.toThrow('ollama pull m:1');
  });

  it('memoiza /api/show por modelo y reintenta si falló', async () => {
    const post = jest
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of({ data: { details: { quantization_level: 'Q4_K_M' } } }));
    const client = makeClient(post);
    expect(await client.showModel('m')).toBeNull(); // Primer intento falla → null, sin romper la generación
    expect((await client.showModel('m'))?.details?.quantization_level).toBe('Q4_K_M');
    await client.showModel('m'); // Tercera llamada: sale del memo
    expect(post).toHaveBeenCalledTimes(2);
  });
});
