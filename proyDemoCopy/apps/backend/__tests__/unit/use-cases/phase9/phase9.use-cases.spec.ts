import { ChangeSongStatusUseCase } from '../../../../src/modules/music/application/use-cases/change-song-status.use-case';
import { buildSongPractice } from '../../../../src/modules/music/application/use-cases/generate-song-practice.use-case';
import type { SongAccess } from '../../../../src/modules/music/application/use-cases/get-song.use-case';
import { splitLyrics } from '../../../../src/modules/music/application/use-cases/replace-song-lines.use-case';
import type { Song } from '../../../../src/modules/music/domain/entities/song.entity';
import {
  licenseProblem,
  type License,
} from '../../../../src/modules/music/domain/value-objects/license.vo';
import { contextOf } from '../../../../src/modules/dialogues/application/use-cases/start-dialogue-session.use-case';
import { SubmitUserTurnUseCase } from '../../../../src/modules/dialogues/application/use-cases/submit-user-turn.use-case';
import type { DialogueTopic } from '../../../../src/modules/dialogues/domain/entities/dialogue-topic.entity';
import { buildDialogueTopicSeed } from '../../../../src/modules/dialogues/infrastructure/seeds/dialogue-topics.seed';
import { itemProblem } from '../../../../src/modules/practice/domain/item-rules';
import {
  slugify,
  TopicCrudService,
} from '../../../../src/shared/application/topic-crud.service';
// [Suite Fase 9 · Sprints 9.2/9.3/9.10/9.15]: letra por líneas, prácticas deterministas de canciones, licencias, máquina de estados de la revisión, temas semilla, TopicCrudService y turno con el avatar | [Patrón]: Test Double (repositorios y puertos en memoria) | [Herramienta]: Jest

const LICENSE: License = {
  type: 'creative_commons',
  source: 'https://example.org',
  holder: 'Aula de Idiomas',
  variant: 'CC BY 4.0',
  confirmed: true,
};
const LYRICS = [
  'Twinkle, twinkle, little star,',
  'How I wonder what you are!',
  'Up above the world so high,',
  'Like a diamond in the sky.',
];

describe('Letras y prácticas de canciones', () => {
  it('splitLyrics quita líneas vacías y espacios', () => {
    expect(splitLyrics('  Hello   world \r\n\n  Bye  ')).toEqual([
      'Hello world',
      'Bye',
    ]);
  });

  it.each(['gap_fill', 'order_lines', 'mark_words'] as const)(
    '%s genera ítems que cumplen las reglas de Practice',
    (kind) => {
      const items = buildSongPractice(LYRICS, kind);
      expect(items.length).toBeGreaterThan(0);
      for (const it of items)
        expect(itemProblem({ options: [], ...it })).toBeNull();
      expect(buildSongPractice(LYRICS, kind)).toEqual(items); // Determinista: misma letra → mismos ítems
    },
  );

  it('completar la letra oculta la palabra más larga y la acepta', () => {
    const [first] = buildSongPractice(LYRICS, 'gap_fill');
    expect(first.prompt).toBe('___, twinkle, little star,');
    expect(first.accepted).toEqual([['Twinkle']]);
  });

  it('marcar la palabra intrusa señala su índice y guarda la corrección', () => {
    const [first] = buildSongPractice(LYRICS, 'mark_words');
    const k = Number(first.accepted[0][0]);
    expect(first.prompt.split(' ')[k]).not.toContain('Twinkle');
    expect(first.corrections?.[String(k)]).toBe('Twinkle');
  });
});

describe('Licencia y revisión de canciones', () => {
  it('licenseProblem exige titular, fuente, variante CC y confirmación', () => {
    expect(licenseProblem(LICENSE)).toBeNull();
    expect(licenseProblem({ ...LICENSE, variant: '' })).toMatch(
      /Creative Commons/,
    );
    expect(licenseProblem({ ...LICENSE, confirmed: false })).toMatch(
      /Confirma/,
    );
    expect(
      licenseProblem({ ...LICENSE, type: 'own_work', source: '' }),
    ).toBeNull(); // Obra propia: sin fuente externa
  });

  const setup = (
    status: Song['status'],
    lines = 3,
    audioKey: string | null = 'k',
  ) => {
    const song = {
      id: 's',
      status,
      license: LICENSE,
      audioKey,
      reviewNote: '',
    } as Song;
    const access = {
      editable: jest.fn(async () => song),
    } as unknown as SongAccess;
    const repo = { save: jest.fn(async (x: Song) => x) };
    const linesRepo = { countBy: jest.fn(async () => lines) };
    return new ChangeSongStatusUseCase(
      access,
      repo as never,
      linesRepo as never,
    );
  };
  const teacher = { id: 't', role: 'TEACHER' };
  const admin = { id: 'a', role: 'ADMIN' };

  it('el docente envía a revisión; solo el ADMIN publica', async () => {
    await expect(
      setup('draft').execute(teacher, 's', 'review'),
    ).resolves.toMatchObject({ status: 'review' });
    await expect(
      setup('review').execute(teacher, 's', 'published'),
    ).rejects.toThrow(/No se puede/);
    await expect(
      setup('review').execute(admin, 's', 'published'),
    ).resolves.toMatchObject({ status: 'published' });
  });

  it('sin audio o sin letra no se envía; rechazar exige motivo', async () => {
    await expect(
      setup('draft', 3, null).execute(teacher, 's', 'review'),
    ).rejects.toThrow(/audio/);
    await expect(
      setup('draft', 0).execute(teacher, 's', 'review'),
    ).rejects.toThrow(/letra/);
    await expect(
      setup('review').execute(admin, 's', 'rejected'),
    ).rejects.toThrow(/por qué/);
    await expect(
      setup('review').execute(admin, 's', 'rejected', 'Sin permiso del autor'),
    ).resolves.toMatchObject({ reviewNote: 'Sin permiso del autor' });
  });
});

describe('Temas de diálogo', () => {
  const seed = buildDialogueTopicSeed() as DialogueTopic[];

  it('ocho temas semilla con vocabulario en los siete idiomas (slugs de las aperturas de FastAPI)', () => {
    expect(seed.map((t) => t.slug)).toEqual([
      'introductions',
      'hobbies',
      'routines',
      'family',
      'animals',
      'food',
      'travel',
      'culture',
    ]);
    for (const t of seed)
      expect(Object.keys(t.vocabulary).sort()).toEqual([
        'de',
        'en',
        'es',
        'fr',
        'pt',
        'ru',
        'zh',
      ]);
  });

  it('TopicCrudService filtra por idioma y nivel y no deja crear dos con el mismo nombre', async () => {
    const rows = seed.map((t, i) => ({ ...t, id: String(i) }));
    const repo = {
      find: jest.fn(async () => rows),
      existsBy: jest.fn(async () => true),
    };
    const crud = new TopicCrudService<DialogueTopic>(repo as never);
    expect((await crud.list({ level: 'C1' })).map((t) => t.slug)).toEqual([
      'culture',
    ]);
    await expect(crud.create('u', { title: 'Comida' })).rejects.toThrow(
      /Ya existe/,
    );
    expect(slugify('Comida y bebida!')).toBe('comida-y-bebida');
  });

  it('contextOf envía a FastAPI solo el vocabulario del idioma de la conversación', () => {
    const food = seed.find((t) => t.slug === 'food')!;
    expect(contextOf(food, 'fr', 3)).toMatchObject({
      topic: 'food',
      turn: 3,
      vocabulary: food.vocabulary.fr,
    });
  });
});

describe('SubmitUserTurnUseCase', () => {
  it('guarda el turno del usuario con la corrección y el del avatar, y acumula el vocabulario', async () => {
    const session = {
      id: 's1',
      userId: 'u',
      topicId: 't',
      language: 'en',
      level: 'A2',
      status: 'active',
      userTurns: 0,
      conversationId: 'c',
      vocabularyUsed: ['pasta'],
    };
    const owned = { load: jest.fn(async () => session) };
    const topics = { get: jest.fn(async () => buildDialogueTopicSeed()[5]) };
    const sessions = { save: jest.fn(async (x: unknown) => x) };
    const turns = {
      countBy: jest.fn(async () => 1),
      create: (x: unknown) => x,
      save: jest.fn(async (x: unknown) => x),
    };
    const agent = {
      turn: jest.fn(async () => ({
        sessionId: 'c2',
        reply: 'Why?',
        answeredBy: 'llm',
        correction: 'Se dice «I like».',
        vocabularyUsed: ['spicy'],
      })),
    };
    const enricher = {
      enrich: jest.fn(async (t: string[]) =>
        t.map(() => ({ ipa: 'x', ipaUs: 'y', translation: 'z' })),
      ),
    };
    const uc = new SubmitUserTurnUseCase(
      owned as never,
      topics as never,
      sessions as never,
      turns as never,
      agent,
      enricher as never,
      { execute: jest.fn() } as never, // EndDialogueSessionUseCase (solo se llama si el usuario se despide)
    );
    const out = await uc.execute('u', 's1', 'I likes spicy food', 'tok');
    expect(out.userTurn).toMatchObject({
      speaker: 'user',
      position: 1,
      correction: 'Se dice «I like».',
    });
    expect(out.avatarTurn).toMatchObject({
      speaker: 'avatar',
      position: 2,
      text: 'Why?',
    });
    expect(out.vocabularyUsed).toEqual(['pasta', 'spicy']);
    expect(session).toMatchObject({ userTurns: 1, conversationId: 'c2' });
    expect(enricher.enrich).toHaveBeenCalledTimes(1); // Una sola llamada a LanguageTools para los dos turnos
  });
});
