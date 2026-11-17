import { Readable } from 'node:stream';
import { isAllowedMime, mimeOfKey, newMediaKey } from '../../../src/modules/curriculum/domain/pronunciation-media';
import { PronunciationMediaController } from '../../../src/modules/curriculum/presentation/pronunciation-media.controller';
import { CURRICULUM_CONTENT_SCHEMAS } from '../../../src/modules/curriculum/domain/content/curriculum-content.schema';
// [Spec pronunciation-media · 2026-11-14]: imagen/video de la boca en «Cómo se pronuncia» — lista blanca, clave sin datos personales,
// subida al almacén y entrega por rangos | [Patrón]: Test Double (ObjectStore en memoria) | [Herramienta]: Jest

function memoryStore() {
  const data = new Map<string, Buffer>();
  return {
    data,
    put: jest.fn(async (k: string, b: Buffer) => void data.set(k, b)),
    size: jest.fn(async (k: string) => data.get(k)?.length ?? null),
    open: jest.fn(async (k: string) => Readable.from(data.get(k)!)),
    remove: jest.fn(),
    signedUrl: jest.fn(async () => null),
  };
}

describe('pronunciation-media (dominio)', () => {
  it('solo imagen y video del navegador; la clave lleva el MIME y un UUID', () => {
    expect(isAllowedMime('video/mp4')).toBe(true);
    expect(isAllowedMime('image/svg+xml')).toBe(false); // SVG puede llevar scripts
    const key = newMediaKey('image/jpeg');
    expect(key).toMatch(/^image-jpeg-[0-9a-f-]{36}$/);
    expect(mimeOfKey(key)).toBe('image/jpeg');
    expect(mimeOfKey('../../etc/passwd')).toBeNull();
  });

  it('el contenido de pronunciación acepta la clave (o vacío) y rechaza rutas', () => {
    const schema = CURRICULUM_CONTENT_SCHEMAS.pronunciation;
    const base = { text: 'hot', ipa: { value: '/hɒt/', variant: 'en-GB', source: 'x' } };
    expect(schema.safeParse({ ...base, mouthMedia: newMediaKey('video/webm') }).success).toBe(true);
    expect(schema.safeParse({ ...base, mouthMedia: '' }).success).toBe(true);
    expect(schema.safeParse({ ...base, mouthMedia: 'http://x/y.mp4' }).success).toBe(false);
    // [2026-11-14]: URL https (imagen externa o YouTube) sí; http, javascript: o rutas no
    expect(schema.safeParse({ ...base, mouthMedia: 'https://youtu.be/dQw4w9WgXcQ' }).success).toBe(true);
    expect(schema.safeParse({ ...base, mouthMedia: 'https://cdn.example.com/boca.png' }).success).toBe(true);
    expect(schema.safeParse({ ...base, mouthMedia: 'javascript:alert(1)' }).success).toBe(false);
    expect(schema.safeParse({ ...base, mouthMedia: '../secreto' }).success).toBe(false);
  });
});

describe('PronunciationMediaController', () => {
  it('sube un video y lo sirve con su tipo; clave inválida o inexistente → 404', async () => {
    const store = memoryStore();
    const ctl = new PronunciationMediaController(store as never);
    const out = await ctl.upload({ buffer: Buffer.from('abc'), mimetype: 'video/mp4', size: 3 });
    expect(out.type).toBe('video');
    expect(store.data.has(out.key)).toBe(true);

    const headers: Record<string, string> = {};
    const res = Object.assign(new (require('node:stream').PassThrough)(), {
      setHeader: (k: string, v: string) => ((headers[k.toLowerCase()] = v), res),
      status: () => res,
    });
    await ctl.serve(out.key, undefined, res as never);
    expect(headers['content-type']).toBe('video/mp4');
    expect(headers['content-length']).toBe('3');

    await expect(ctl.serve('nada', undefined, res as never)).rejects.toThrow('no encontrado');
    await expect(ctl.serve(newMediaKey('image/png'), undefined, res as never)).rejects.toThrow('no encontrado');
  });

  it('sin archivo o con otro tipo → 400', async () => {
    const ctl = new PronunciationMediaController(memoryStore() as never);
    await expect(ctl.upload(undefined)).rejects.toThrow('Adjunta');
    await expect(ctl.upload({ buffer: Buffer.from('x'), mimetype: 'application/pdf', size: 1 })).rejects.toThrow('Adjunta');
  });
});
