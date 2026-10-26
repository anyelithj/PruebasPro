import zlib from 'node:zlib';
import { WebFetchError } from '../../../src/modules/music/domain/interfaces/web-page-fetcher.interface';
import {
  assertPublicUrl,
  decompress,
  isPrivateAddress,
  PublicWebFetcher,
} from '../../../src/modules/music/infrastructure/web/public-web-fetcher.adapter';
// [Pruebas PublicWebFetcher · 2026-10-24]: anti-SSRF, descompresión, reintento con otro perfil de navegador ante un 403 y diagnóstico de anti-bots | [Patrón]: Test Double (se sustituye el GET de bajo nivel con jest.spyOn)

type Raw = { status: number; headers: Record<string, string | string[]>; body: Buffer };
// `jest.spyOn(prototype, 'request')`: el método privado de red se reemplaza por respuestas en cola (sin red real)
function stubRequests(responses: Raw[]) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  jest
    .spyOn(PublicWebFetcher.prototype as unknown as { request: (u: URL, h: Record<string, string>) => Promise<Raw> }, 'request')
    .mockImplementation(async (u: URL, h: Record<string, string>) => {
      calls.push({ url: u.toString(), headers: h });
      const next = responses.shift();
      if (!next) throw new Error('sin más respuestas');
      return next;
    });
  return calls;
}

afterEach(() => jest.restoreAllMocks());

describe('PublicWebFetcher', () => {
  it('rechaza redes privadas, puertos raros y credenciales', () => {
    for (const u of ['http://127.0.0.1/x', 'http://localhost/x', 'http://[::1]/', 'https://a.com:8080/', 'https://u:p@a.com/', 'ftp://a.com/'])
      expect(() => assertPublicUrl(u)).toThrow(WebFetchError);
    expect(isPrivateAddress('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateAddress('93.184.216.34')).toBe(false);
  });

  it('descomprime gzip y brotli', () => {
    expect(decompress(zlib.gzipSync('hola'), 'gzip').toString()).toBe('hola');
    expect(decompress(zlib.brotliCompressSync('hola'), 'br').toString()).toBe('hola');
  });

  it('un 403 como Chrome se reintenta como Firefox con Referer', async () => {
    const calls = stubRequests([
      { status: 403, headers: {}, body: Buffer.from('Forbidden') },
      { status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from('<p>ok</p>') },
    ]);
    const page = await new PublicWebFetcher().fetch('https://letras.example/cancion');
    expect(page.body.toString()).toBe('<p>ok</p>');
    expect(calls[0]!.headers['User-Agent']).toMatch(/Chrome/);
    expect(calls[0]!.headers['User-Agent']).not.toMatch(/Aula|Importador/i); // Sin sufijo de bot
    expect(calls[1]!.headers).toMatchObject({ Referer: 'https://letras.example/' });
    expect(calls[1]!.headers['User-Agent']).toMatch(/Firefox/);
  });

  it('sigue redirecciones llevando las cookies del sitio', async () => {
    const calls = stubRequests([
      { status: 302, headers: { location: '/final', 'set-cookie': ['sid=abc; Path=/; HttpOnly'] }, body: Buffer.alloc(0) },
      { status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from('fin') },
    ]);
    const page = await new PublicWebFetcher().fetch('https://a.example/start');
    expect(page.url).toBe('https://a.example/final');
    expect(calls[1]!.headers.Cookie).toBe('sid=abc');
  });

  it('anti-bots con JavaScript → motivo «challenge» (sin reintentos inútiles)', async () => {
    stubRequests([{ status: 403, headers: { 'cf-mitigated': 'challenge' }, body: Buffer.from('Just a moment...') }]);
    await expect(new PublicWebFetcher().fetch('https://b.example/')).rejects.toMatchObject({ reason: 'challenge' });
  });
});
