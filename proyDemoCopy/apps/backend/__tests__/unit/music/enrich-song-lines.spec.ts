import type {
  LanguageToolsPort,
  LinesResult,
} from '../../../src/shared/domain/interfaces/language-tools.interface';
import {
  chunk,
  ENRICH_CHUNK,
  EnrichSongLinesUseCase,
} from '../../../src/modules/music/application/use-cases/enrich-song-lines.use-case';
import type { SongAccess } from '../../../src/modules/music/application/use-cases/get-song.use-case';
import type { SongLine } from '../../../src/modules/music/domain/entities/song-line.entity';
// [Pruebas EnrichSongLines · 2026-10-24]: trozos de 20 líneas, reintento y respaldo de IPA cuando FastAPI no responde | [Patrón]: Test Double (repositorio en memoria + puerto falso)

const line = (position: number): SongLine =>
  ({ id: `l${position}`, songId: 's', position, text: `line ${position}`, ipa: '', ipaUs: null, translation: null, reviewed: false }) as SongLine;

// [Repositorio en memoria]: solo find/save, lo que usa el caso de uso
function repo(lines: SongLine[]) {
  return {
    find: jest.fn(async ({ where }: { where: { reviewed?: boolean } }) => lines.filter((l) => where.reviewed === undefined || l.reviewed === where.reviewed)),
    save: jest.fn(async (x: SongLine[]) => x),
  };
}

const access = { editable: jest.fn(async () => ({ id: 's', language: 'en' })) } as unknown as SongAccess;
const ok = (texts: string[]): LinesResult => ({
  lines: texts.map((t, index) => ({ index, text: t, translation: `es ${t}`, ipa: `/${t}/`, ipa_us: `/${t}/us` })),
  engine: 'fake',
  needs_native_review: false,
});

describe('EnrichSongLinesUseCase', () => {
  it('parte la letra en trozos de 20 y no deja nada pendiente', async () => {
    const lines = Array.from({ length: 45 }, (_, i) => line(i));
    const tools = { lines: jest.fn(async (t: string[]) => ok(t)), ipa: jest.fn() } as unknown as LanguageToolsPort;
    const uc = new EnrichSongLinesUseCase(access, repo(lines) as never, tools);
    const out = await uc.run({ id: 'u', role: 'TEACHER' }, 's', 'tok');
    expect((tools.lines as jest.Mock).mock.calls.map((c) => (c[0] as string[]).length)).toEqual([20, 20, 5]);
    expect(out.missing).toBe(0);
  });

  it('reintenta una vez y, si FastAPI sigue sin responder, deja al menos el IPA', async () => {
    const lines = [line(0), line(1)];
    const tools = {
      lines: jest.fn(async () => {
        throw new Error('timeout');
      }),
      ipa: jest.fn(async (t: string) => ({ ipa: `/${t}/`, ipa_us: null, engine: 'espeak' })),
    } as unknown as LanguageToolsPort;
    const out = await new EnrichSongLinesUseCase(access, repo(lines) as never, tools).run({ id: 'u', role: 'TEACHER' }, 's', 'tok');
    expect(tools.lines).toHaveBeenCalledTimes(2); // 1 intento + 1 reintento
    expect(lines.map((l) => l.ipa)).toEqual(['/line 0/', '/line 1/']);
    expect(out.missing).toBe(2); // Falta la traducción → la UI ofrece reintentar
  });

  it('chunk reparte en grupos del tamaño pedido', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(ENRICH_CHUNK).toBeLessThanOrEqual(40); // FastAPI traduce cada trozo en UNA llamada al LLM
  });
});
