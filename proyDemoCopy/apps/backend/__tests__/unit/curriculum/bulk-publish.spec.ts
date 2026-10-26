import { ForbiddenException } from '@nestjs/common';
import { BulkPublishCommand } from '../../../src/modules/curriculum/application/commands/bulk-publish.command';
import { ChangeReviewStatusCommand } from '../../../src/modules/curriculum/application/commands/change-review-status.command';
import { publishSteps, ReviewStatus } from '../../../src/modules/curriculum/domain/value-objects/review-status.vo';
import { Role } from '../../../src/modules/users/domain/value-objects/role.vo';

// [Suite publicación en lote · 2026-10-24]: un tema completo se publica en UNA petición, sin saltos de estado y de forma idempotente (reintentar completa lo que faltó)
// [Patrón]: Test Double (repositorio en memoria) — sin BD ni red

const admin = { id: 'a1', role: Role.ADMIN };
const teacher = { id: 't1', role: Role.TEACHER };

// [Repositorio en memoria]: `Map` id → recurso; saveWithRevision sube la versión como el adapter real
function memoryRepo(statuses: Record<string, ReviewStatus>) {
  const db = new Map(Object.entries(statuses).map(([id, reviewStatus]) => [id, { id, reviewStatus, version: 1, createdBy: 'a1', topic: 'Fruits' }]));
  return {
    db,
    findById: jest.fn(async (id: string) => (db.has(id) ? { ...db.get(id)! } : null)),
    saveWithRevision: jest.fn(async (item: { id: string; version: number }) => {
      const saved = { ...item, version: item.version + 1 } as never;
      db.set(item.id, saved);
      return saved;
    }),
  };
}
const make = (repo: ReturnType<typeof memoryRepo>) => new BulkPublishCommand(repo as never, new ChangeReviewStatusCommand(repo as never));

describe('publishSteps', () => {
  it('recorre la máquina de estados sin saltos y es idempotente', () => {
    expect(publishSteps(ReviewStatus.DRAFT, true)).toEqual([ReviewStatus.REVIEW_REQUIRED, ReviewStatus.REVIEWED, ReviewStatus.APPROVED]);
    expect(publishSteps(ReviewStatus.APPROVED, true)).toEqual([]);
    expect(publishSteps(ReviewStatus.APPROVED, false)).toEqual([ReviewStatus.DRAFT]);
    expect(publishSteps(ReviewStatus.DRAFT, false)).toEqual([]);
  });
});

describe('BulkPublishCommand', () => {
  it('publica todos los recursos del lote y omite los ya publicados (reintento de un «Parcial 66/69»)', async () => {
    const repo = memoryRepo({ a: ReviewStatus.DRAFT, b: ReviewStatus.GENERATED, c: ReviewStatus.APPROVED });
    const r = await make(repo).execute(['a', 'b', 'c', 'a'], true, admin);
    expect(r).toEqual({ total: 3, changed: 2, unchanged: 1, failed: [] });
    expect([...repo.db.values()].every((i) => i.reviewStatus === ReviewStatus.APPROVED)).toBe(true);
  });

  it('un fallo individual no detiene el resto', async () => {
    const repo = memoryRepo({ a: ReviewStatus.DRAFT, b: ReviewStatus.DRAFT });
    const r = await make(repo).execute(['a', 'missing', 'b'], true, admin);
    expect(r.changed).toBe(2);
    expect(r.failed).toEqual([{ id: 'missing', message: 'Recurso no encontrado' }]);
  });

  it('despublicar devuelve a borrador solo lo publicado', async () => {
    const repo = memoryRepo({ a: ReviewStatus.APPROVED, b: ReviewStatus.DRAFT });
    const r = await make(repo).execute(['a', 'b'], false, admin);
    expect(r).toMatchObject({ changed: 1, unchanged: 1 });
    expect(repo.db.get('a')!.reviewStatus).toBe(ReviewStatus.DRAFT);
  });

  it('solo ADMIN publica', async () => {
    await expect(make(memoryRepo({ a: ReviewStatus.DRAFT })).execute(['a'], true, teacher)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
