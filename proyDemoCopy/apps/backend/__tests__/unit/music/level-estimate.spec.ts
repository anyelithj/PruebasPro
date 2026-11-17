import { ServiceUnavailableException } from '@nestjs/common';
import { ReplaceSongLinesUseCase } from '../../../src/modules/music/application/use-cases/replace-song-lines.use-case';
import { CreateReadingTextUseCase } from '../../../src/modules/reading/application/use-cases/create-reading-text.use-case';
import type { LevelClassifierPort } from '../../../src/modules/dialogues/domain/interfaces/level-classifier.interface';
// [Pruebas RF-148 · 2026-11-16]: nivel MCER estimado del texto (canción al cargar la letra · lectura al crearla) | [Patrón]: Test Double (puertos y repositorios falsos)

const estimate = (level: string) => ({ level, confidence: 0.8, method: 'rules', indicators: {}, explanation: '', model: null });
const classifier = (impl: () => Promise<unknown>) => ({ classify: jest.fn(impl) }) as unknown as LevelClassifierPort & { classify: jest.Mock };
const down = () => classifier(async () => { throw new Error('FastAPI caído'); });

describe('ReplaceSongLines · nivel de la letra', () => {
  const build = (level: string | null, c: LevelClassifierPort) => {
    const songs = { update: jest.fn() };
    const lines = { manager: { transaction: jest.fn() }, find: jest.fn(async () => []) };
    const access = { editable: jest.fn(async () => ({ id: 's', language: 'en', level })) };
    const uc = new ReplaceSongLinesUseCase(access as never, lines as never, {} as never, songs as never, c);
    return { uc, songs };
  };
  const load = (uc: ReplaceSongLinesUseCase) => uc.execute({ id: 'u', role: 'TEACHER' }, 's', 'Hello world\nI love you', 'tok', false);

  it('canción sin nivel → guarda el nivel estimado de los versos', async () => {
    const c = classifier(async () => estimate('A2'));
    const { uc, songs } = build(null, c);
    await load(uc);
    expect(c.classify).toHaveBeenCalledWith({ language: 'en', turns: ['Hello world', 'I love you'] }, 'tok');
    expect(songs.update).toHaveBeenCalledWith({ id: 's' }, { level: 'A2' });
  });

  it('el nivel elegido por el docente prevalece (no se llama a la IA)', async () => {
    const c = classifier(async () => estimate('C1'));
    const { uc, songs } = build('B1', c);
    await load(uc);
    expect(c.classify).not.toHaveBeenCalled();
    expect(songs.update).not.toHaveBeenCalled();
  });

  it('si la IA no responde la letra se guarda igual y la canción queda sin nivel', async () => {
    const { uc, songs } = build(null, down());
    await expect(load(uc)).resolves.toBeDefined();
    expect(songs.update).not.toHaveBeenCalled();
  });
});

describe('CreateReadingText · nivel del texto', () => {
  const build = (c: LevelClassifierPort) => {
    const texts = { findBy: jest.fn(async () => []), find: jest.fn(async () => []), create: jest.fn((x) => x), save: jest.fn(async (x) => ({ id: 'r', ...x })) };
    const writer = { write: jest.fn(async () => ({ sentences: [], pending: 0, enriching: false })) };
    return { uc: new CreateReadingTextUseCase(texts as never, writer as never, c), texts };
  };
  const body = (level?: string) => ({ title: 'The fox', language: 'en', level, genre: 'story', paragraphs: ['The fox runs.', 'It is fast.'] }) as never;

  it('sin nivel → se guarda con el nivel estimado', async () => {
    const c = classifier(async () => estimate('A1'));
    const { uc, texts } = build(c);
    await uc.execute({ id: 'u', role: 'TEACHER' } as never, body(), 'tok');
    expect(c.classify).toHaveBeenCalledWith({ language: 'en', turns: ['The fox runs.', 'It is fast.'] }, 'tok');
    expect(texts.create).toHaveBeenCalledWith(expect.objectContaining({ level: 'A1' }));
  });

  it('con nivel → no se estima', async () => {
    const c = classifier(async () => estimate('C2'));
    const { uc, texts } = build(c);
    await uc.execute({ id: 'u', role: 'TEACHER' } as never, body('B2'), 'tok');
    expect(c.classify).not.toHaveBeenCalled();
    expect(texts.create).toHaveBeenCalledWith(expect.objectContaining({ level: 'B2' }));
  });

  it('sin nivel y la IA no responde → 503 accionable, no se guarda', async () => {
    const { uc, texts } = build(down());
    await expect(uc.execute({ id: 'u', role: 'TEACHER' } as never, body(), 'tok')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(texts.save).not.toHaveBeenCalled();
  });
});
