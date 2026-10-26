import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { contextFor, OllamaClient, paramsOf } from '../../../src/modules/ai/ollama.client';

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
    expect(qwenBody).toMatchObject({ format: 'json', stream: false, keep_alive: '2m', think: false });
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

  // [2026-10-24 · Poca RAM]: ventana medida, liberación de modelos y cadena de respaldo
  const OOM = { response: { status: 500, data: { error: 'llama-server reported out-of-memory during startup: failed to allocate CPU_REPACK buffer of size 1327104000' } } };
  const req = (model = 'qwen2.5:3b') => ({ model, prompt: 'p', options: { temperature: 0, num_predict: 100, num_ctx: 8192 } });
  // [Ollama simulado]: /api/generate falla por RAM para los modelos de `oomFor`; las descargas (keep_alive 0) responden ok
  const fakeOllama = (oomFor: string[]) =>
    jest.fn((url: string, body: { model: string; keep_alive?: unknown }) => {
      if (url.endsWith('/api/generate') && body.keep_alive === 0) return of({ data: {} });
      return oomFor.includes(body.model) ? throwError(() => OOM) : of({ data: { response: '{}' } });
    });
  const getWith = (ps: string[], tags: string[]) =>
    jest.fn((url: string) => of({ data: { models: (url.endsWith('/api/ps') ? ps : tags).map((name) => ({ name })) } }));

  it('dimensiona num_ctx al prompt (no al contexto por defecto del modelo) y acota a OLLAMA_NUM_CTX', async () => {
    expect(contextFor('p', 100, 4096)).toBe(2048);
    expect(contextFor('x'.repeat(9000), 3500, 4096)).toBe(4096);
    expect(paramsOf('qwen2.5:3b')).toBe(3);
    expect(paramsOf('qwen2.5:0.5b')).toBe(0.5);
    const post = jest.fn().mockReturnValue(of({ data: { response: '{}' } }));
    await makeClient(post).generate(req());
    expect(post.mock.calls[0][1].options).toMatchObject({ num_ctx: 2048, num_predict: 100 });
  });

  it('sin RAM: descarga los demás modelos residentes y reintenta el mismo', async () => {
    let calls = 0;
    const post = jest.fn((_url: string, body: { model: string; keep_alive?: unknown }) => {
      if (body.keep_alive === 0) return of({ data: {} });
      calls++;
      return calls === 1 ? throwError(() => OOM) : of({ data: { response: '{"ok":1}' } });
    });
    const res = await makeClient(post, getWith(['aya-expanse:8b'], [])).generate(req());
    expect(res.model).toBe('qwen2.5:3b');
    expect(post).toHaveBeenCalledWith(expect.stringContaining('/api/generate'), { model: 'aya-expanse:8b', keep_alive: 0 }, expect.anything());
  });

  it('sin RAM: usa el primer respaldo INSTALADO de la cadena', async () => {
    const post = fakeOllama(['qwen2.5:3b']);
    const res = await makeClient(post, getWith([], ['qwen2.5:3b', 'qwen2.5:0.5b'])).generate(req());
    expect(res.model).toBe('qwen2.5:0.5b'); // qwen2.5:1.5b no está instalado → se salta
  });

  it('sin RAM y sin respaldo instalado: sugiere un modelo MÁS PEQUEÑO (no el mismo) con su ollama pull', async () => {
    const promise = makeClient(fakeOllama(['qwen2.5:3b']), getWith([], ['qwen2.5:3b'])).generate(req());
    await expect(promise).rejects.toThrow('ollama pull qwen2.5:1.5b');
    await expect(makeClient(fakeOllama(['qwen2.5:3b']), getWith([], ['qwen2.5:3b'])).generate(req())).rejects.not.toThrow(/p\. ej\. qwen2\.5:3b/);
  });

  it('el modelo más pequeño tampoco cabe → pide liberar RAM', async () => {
    const promise = makeClient(fakeOllama(['qwen2.5:0.5b']), getWith([], ['qwen2.5:0.5b'])).generate(req('qwen2.5:0.5b'));
    await expect(promise).rejects.toThrow(/cierra aplicaciones/);
  });

  it('OLLAMA_FALLBACK_MODELS configura la cadena', async () => {
    const cfg = { get: (k: string, d?: unknown) => (k === 'OLLAMA_FALLBACK_MODELS' ? 'llama3.2:1b' : d) } as never;
    const client = new OllamaClient({ post: fakeOllama(['qwen2.5:3b']), get: getWith([], ['llama3.2:1b']) } as never, cfg);
    expect(client.fallbackModels).toEqual(['llama3.2:1b']);
    expect((await client.generate(req())).model).toBe('llama3.2:1b');
  });
});
