import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreateCurriculumItemCommand } from '../../../src/modules/curriculum/application/commands/create-curriculum-item.command';
import { CreateSourceCommand } from '../../../src/modules/curriculum/application/commands/create-source.command';
import { CreateTopicCommand } from '../../../src/modules/curriculum/application/commands/create-topic.command';
import { CheckKeyQuery } from '../../../src/modules/curriculum/application/queries/catalog.queries';
import { slugify } from '../../../src/modules/curriculum/domain/slug';
import { CurriculumItemKind } from '../../../src/modules/curriculum/domain/value-objects/curriculum-item-kind.vo';
import { Provenance } from '../../../src/modules/curriculum/domain/value-objects/provenance.vo';
import { Role } from '../../../src/modules/users/domain/value-objects/role.vo';
import { CefrLevel } from '../../../src/shared/domain/cefr-level.vo';
import { Language } from '../../../src/shared/domain/language.vo';
import { LanguageSkill } from '../../../src/shared/domain/language-skill.vo';

// [Suite catálogo curricular]: slug determinista, temas, fuentes y clave (sin LLM)

const admin = { id: 'a1', role: Role.ADMIN };
const own = { id: 'own', name: 'Contenido propio', isOwnContent: true };
const bc = { id: 'bc', name: 'British Council', isOwnContent: false };
const presentSimple = {
  id: 't1',
  name: 'Present Simple',
  slug: 'present-simple',
  language: Language.EN,
  level: CefrLevel.A1,
  skill: LanguageSkill.GRAMMAR,
  kind: null,
};

function makeRepo() {
  return {
    findById: jest.fn(),
    findByNaturalKey: jest.fn().mockResolvedValue(null),
    search: jest.fn(),
    listRevisions: jest.fn(),
    createWithRevision: jest.fn((item: object, _meta: object) => Promise.resolve({ id: 'new', version: 1, ...item })),
    saveWithRevision: jest.fn(),
    searchTopics: jest.fn(),
    findTopicById: jest.fn().mockResolvedValue(presentSimple),
    findTopic: jest.fn().mockResolvedValue(null),
    createTopic: jest.fn((t: object) => Promise.resolve({ id: 'nt', ...t })),
    searchSources: jest.fn(),
    findSourceById: jest.fn((id: string) => Promise.resolve(id === 'own' ? own : id === 'bc' ? bc : null)),
    findSourceBySlug: jest.fn().mockResolvedValue(null),
    createSource: jest.fn((s: object) => Promise.resolve({ id: 'ns', ...s })),
  };
}

const baseItem = {
  key: 'manual-key',
  kind: CurriculumItemKind.GRAMMAR_RULE,
  language: Language.EN,
  level: CefrLevel.A1,
  skill: LanguageSkill.GRAMMAR,
  topic: 'x',
  content: { title: 'Present Simple', explanationEs: 'Hábitos y verdades generales.' },
};

describe('slugify (determinista)', () => {
  it.each([
    ['Present Simple', 'present-simple'],
    ['Present Perfect', 'present-perfect'],
    ['Présent composé', 'present-compose'],
    ['  There is / There are  ', 'there-is-there-are'],
    ["Can / Can't", 'can-can-t'],
    ['Straße--Übung', 'strasse-ubung'],
    ['Падежи', 'padezhi'],
    ['你好', ''],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('CreateTopicCommand', () => {
  it('genera el slug en backend', async () => {
    const repo = makeRepo();
    const t = await new CreateTopicCommand(repo as never).execute(
      { name: 'Présent composé', language: Language.FR, level: CefrLevel.A2, skill: LanguageSkill.GRAMMAR },
      admin,
    );
    expect(t.slug).toBe('present-compose');
  });

  it('rechaza un tema equivalente', async () => {
    const repo = makeRepo();
    repo.findTopic.mockResolvedValue(presentSimple);
    await expect(
      new CreateTopicCommand(repo as never).execute(
        { name: 'present  simple', language: Language.EN, level: CefrLevel.A1, skill: LanguageSkill.GRAMMAR },
        admin,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza nombres que no generan slug', async () => {
    await expect(
      new CreateTopicCommand(makeRepo() as never).execute(
        { name: '你好', language: Language.ZH, level: CefrLevel.A1, skill: LanguageSkill.VOCABULARY },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CreateSourceCommand', () => {
  it('atribución por plantilla fija si no se indica', async () => {
    const s = await new CreateSourceCommand(makeRepo() as never).execute({ name: 'British Council', license: 'CC BY 4.0' });
    expect(s.attribution).toBe('British Council. Material utilizado/adaptado según la licencia registrada (CC BY 4.0).');
    expect(s.isOwnContent).toBe(false);
  });
});

describe('CreateCurriculumItemCommand con catálogo', () => {
  it('deriva key y topic del tema y usa "Contenido propio" en procedencia manual', async () => {
    const repo = makeRepo();
    repo.findSourceBySlug.mockResolvedValue(own);
    const item = await new CreateCurriculumItemCommand(repo as never).execute({ ...baseItem, topicId: 't1' }, admin);
    expect(item.key).toBe('present-simple');
    expect(item.topic).toBe('Present Simple');
    expect(item.sourceId).toBe('own');
    expect(item.source).toBe('Contenido propio');
  });

  it('rechaza un tema incompatible con el nivel', async () => {
    const repo = makeRepo();
    await expect(
      new CreateCurriculumItemCommand(repo as never).execute({ ...baseItem, level: CefrLevel.B2, topicId: 't1' }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('importado exige fuente externa (no "Contenido propio")', async () => {
    const repo = makeRepo();
    await expect(
      new CreateCurriculumItemCommand(repo as never).execute(
        { ...baseItem, provenance: Provenance.IMPORTED, sourceId: 'own' },
        admin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    const ok = await new CreateCurriculumItemCommand(repo as never).execute(
      { ...baseItem, provenance: Provenance.IMPORTED, sourceId: 'bc' },
      admin,
    );
    expect(ok.source).toBe('British Council');
  });

  it('conflicto de clave con mensaje claro', async () => {
    const repo = makeRepo();
    repo.findByNaturalKey.mockResolvedValue({ id: 'x', topic: 'Present Simple' });
    await expect(
      new CreateCurriculumItemCommand(repo as never).execute({ ...baseItem, topicId: 't1' }, admin),
    ).rejects.toThrow(/ya está en uso/);
  });
});

describe('CheckKeyQuery', () => {
  it('informa conflicto y excluye el propio recurso', async () => {
    const repo = makeRepo();
    repo.findByNaturalKey.mockResolvedValue({ id: 'x', topic: 'Present Simple' });
    const q = new CheckKeyQuery(repo as never);
    const dto = { language: Language.EN, kind: CurriculumItemKind.GRAMMAR_RULE, key: 'present-simple' };
    expect(await q.execute(dto)).toEqual({ available: false, conflict: { id: 'x', topic: 'Present Simple' } });
    expect(await q.execute({ ...dto, excludeId: 'x' })).toEqual({ available: true });
  });
});
