import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChangeReviewStatusCommand } from '../../../src/modules/curriculum/application/commands/change-review-status.command';
import { CreateCurriculumItemCommand } from '../../../src/modules/curriculum/application/commands/create-curriculum-item.command';
import { UpdateCurriculumItemCommand } from '../../../src/modules/curriculum/application/commands/update-curriculum-item.command';
import { GetCurriculumItemQuery } from '../../../src/modules/curriculum/application/queries/get-curriculum-item.query';
import { ListCurriculumItemsQuery } from '../../../src/modules/curriculum/application/queries/list-curriculum-items.query';
import { RevisionChangeType } from '../../../src/modules/curriculum/domain/entities/curriculum-item-revision.entity';
import { CurriculumVersionConflictError } from '../../../src/modules/curriculum/domain/interfaces/curriculum.repository.interface';
import { CurriculumItemKind } from '../../../src/modules/curriculum/domain/value-objects/curriculum-item-kind.vo';
import { Provenance } from '../../../src/modules/curriculum/domain/value-objects/provenance.vo';
import { ReviewStatus } from '../../../src/modules/curriculum/domain/value-objects/review-status.vo';
import { Role } from '../../../src/modules/users/domain/value-objects/role.vo';
import { CefrLevel } from '../../../src/shared/domain/cefr-level.vo';
import { Language } from '../../../src/shared/domain/language.vo';
import { LanguageSkill } from '../../../src/shared/domain/language-skill.vo';

// [Suite comandos/consultas curriculares]: reglas de aplicación con el puerto del repositorio simulado (sin BD)

const teacher = { id: 't1', role: Role.TEACHER };
const admin = { id: 'a1', role: Role.ADMIN };
const student = { id: 's1', role: Role.USER };

// [Fábrica de mocks]: implementa el puerto con jest.fn → pruebas de la capa de aplicación aisladas | [Patrón]: Test Double
function makeRepo() {
  return {
    findById: jest.fn(),
    findByNaturalKey: jest.fn().mockResolvedValue(null),
    search: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    listRevisions: jest.fn().mockResolvedValue([]),
    createWithRevision: jest.fn((item: object, _meta: object) => Promise.resolve({ id: "new", version: 1, ...item })),
    saveWithRevision: jest.fn((item) => Promise.resolve({ ...item, version: item.version + 1 })),
    // Catálogo
    findTopicById: jest.fn().mockResolvedValue(null),
    findSourceById: jest.fn().mockResolvedValue(null),
    findSourceBySlug: jest.fn().mockResolvedValue({ id: "own", name: "Contenido propio", isOwnContent: true }),
  };
}

const validDto = {
  key: 'present-perfect',
  kind: CurriculumItemKind.GRAMMAR_RULE,
  language: Language.EN,
  level: CefrLevel.B1,
  skill: LanguageSkill.GRAMMAR,
  topic: 'Tiempos verbales',
  content: { title: 'Present perfect', explanationEs: 'Pasado con relevancia presente.' },
};

const existingItem = () => ({
  id: 'i1',
  ...validDto,
  provenance: Provenance.MANUAL,
  reviewStatus: ReviewStatus.DRAFT,
  reviewNote: null,
  version: 3,
});

describe('CreateCurriculumItemCommand', () => {
  it('crea en borrador con revisión CREATED', async () => {
    const repo = makeRepo();
    const item = await new CreateCurriculumItemCommand(repo as never).execute(validDto, teacher);
    expect(item.reviewStatus).toBe(ReviewStatus.DRAFT);
    expect(repo.createWithRevision.mock.calls[0][1]).toEqual({ changeType: RevisionChangeType.CREATED, changedBy: 't1' });
  });

  it('lo creado desde un borrador de IA nace GENERATED (nunca como verificado)', async () => {
    const repo = makeRepo();
    const item = await new CreateCurriculumItemCommand(repo as never).execute(
      { ...validDto, provenance: Provenance.GENERATED, generationId: '00000000-0000-0000-0000-000000000001' },
      teacher,
    );
    expect(item.reviewStatus).toBe(ReviewStatus.GENERATED);
  });

  it('rechaza duplicados por clave natural (idempotencia)', async () => {
    const repo = makeRepo();
    repo.findByNaturalKey.mockResolvedValue({ id: 'dup' });
    await expect(new CreateCurriculumItemCommand(repo as never).execute(validDto, teacher)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rechaza contenido que no cumple el esquema del tipo', async () => {
    const repo = makeRepo();
    await expect(
      new CreateCurriculumItemCommand(repo as never).execute({ ...validDto, content: { title: 'x' } }, teacher),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un docente no puede declarar "validado por especialista"', async () => {
    const repo = makeRepo();
    await expect(
      new CreateCurriculumItemCommand(repo as never).execute({ ...validDto, provenance: Provenance.EXPERT_VALIDATED }, teacher),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('contenido importado exige fuente', async () => {
    const repo = makeRepo();
    await expect(
      new CreateCurriculumItemCommand(repo as never).execute({ ...validDto, provenance: Provenance.IMPORTED }, teacher),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UpdateCurriculumItemCommand', () => {
  it('409 si la versión esperada no coincide', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(existingItem());
    await expect(
      new UpdateCurriculumItemCommand(repo as never).execute('i1', { expectedVersion: 2, topic: 'Nuevo' }, teacher),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('editar contenido aprobado lo devuelve a borrador', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue({ ...existingItem(), reviewStatus: ReviewStatus.APPROVED });
    const saved = await new UpdateCurriculumItemCommand(repo as never).execute(
      'i1',
      { expectedVersion: 3, topic: 'Nuevo tema' },
      teacher,
    );
    expect(saved.reviewStatus).toBe(ReviewStatus.DRAFT);
    expect(saved.topic).toBe('Nuevo tema');
  });

  it('traduce el conflicto de la transacción a 409', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(existingItem());
    repo.saveWithRevision.mockRejectedValue(new CurriculumVersionConflictError('i1', 3));
    await expect(
      new UpdateCurriculumItemCommand(repo as never).execute('i1', { expectedVersion: 3, topic: 'x y' }, teacher),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('ChangeReviewStatusCommand', () => {
  it('no permite draft → approved', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(existingItem());
    await expect(
      new ChangeReviewStatusCommand(repo as never).execute('i1', { status: ReviewStatus.APPROVED, expectedVersion: 3 }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('solo ADMIN aprueba (desde «revisado»)', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue({ ...existingItem(), reviewStatus: ReviewStatus.REVIEWED });
    const cmd = new ChangeReviewStatusCommand(repo as never);
    await expect(cmd.execute('i1', { status: ReviewStatus.APPROVED, expectedVersion: 3 }, teacher)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const ok = await cmd.execute('i1', { status: ReviewStatus.APPROVED, expectedVersion: 3 }, admin);
    expect(ok.reviewStatus).toBe(ReviewStatus.APPROVED);
    expect(ok.reviewedBy).toBe('a1');
  });

  it('un docente marca «revisado» y queda firmado', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue({ ...existingItem(), reviewStatus: ReviewStatus.REVIEW_REQUIRED });
    const ok = await new ChangeReviewStatusCommand(repo as never).execute('i1', { status: ReviewStatus.REVIEWED, expectedVersion: 3 }, teacher);
    expect(ok.reviewStatus).toBe(ReviewStatus.REVIEWED);
    expect(ok.reviewedBy).toBe(teacher.id);
  });

  it('devolver (revisión → borrador) exige motivo y es solo del ADMIN', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue({ ...existingItem(), reviewStatus: ReviewStatus.REVIEW_REQUIRED });
    const cmd = new ChangeReviewStatusCommand(repo as never);
    await expect(cmd.execute('i1', { status: ReviewStatus.DRAFT, expectedVersion: 3 }, admin)).rejects.toBeInstanceOf(BadRequestException);
    await expect(cmd.execute('i1', { status: ReviewStatus.DRAFT, expectedVersion: 3, note: 'falta IPA' }, teacher)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const ok = await cmd.execute('i1', { status: ReviewStatus.DRAFT, expectedVersion: 3, note: 'falta IPA' }, admin);
    expect(ok.reviewStatus).toBe(ReviewStatus.DRAFT);
    expect(ok.reviewNote).toBe('falta IPA');
  });
});

describe('Consultas curriculares', () => {
  it('un estudiante solo consulta contenido aprobado aunque pida otro estado', async () => {
    const repo = makeRepo();
    await new ListCurriculumItemsQuery(repo as never).execute({ status: ReviewStatus.DRAFT }, student);
    expect(repo.search.mock.calls[0][0].statuses).toEqual([ReviewStatus.APPROVED]);
  });

  it('un estudiante recibe 404 para contenido no aprobado y no ve el historial', async () => {
    const repo = makeRepo();
    repo.findById.mockResolvedValue(existingItem());
    await expect(new GetCurriculumItemQuery(repo as never, { findOne: jest.fn() } as never).execute('i1', student)).rejects.toBeInstanceOf(NotFoundException);
    repo.findById.mockResolvedValue({ ...existingItem(), reviewStatus: ReviewStatus.APPROVED });
    const view = await new GetCurriculumItemQuery(repo as never, { findOne: jest.fn() } as never).execute('i1', student);
    expect(view.revisions).toBeUndefined();
    expect(repo.listRevisions).not.toHaveBeenCalled();
  });
});
