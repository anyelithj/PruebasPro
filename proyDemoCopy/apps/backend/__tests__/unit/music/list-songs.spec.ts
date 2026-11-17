import { IsNull } from 'typeorm';
import { ListSongsUseCase } from '../../../src/modules/music/application/use-cases/list-songs.use-case';
import type { Song } from '../../../src/modules/music/domain/entities/song.entity';
// [Pruebas ListSongs · 2026-10-28]: «mías» en Gestión — el ADMIN ve TODAS las canciones (borradores y cola de revisión de los docentes), el docente solo las suyas y el estudiante solo publicadas | [Patrón]: Test Double (repositorio que captura el `where`)

const song = { id: 's1', title: 'Hello', status: 'draft', license: null, audioKey: null } as unknown as Song;

// [Repositorio en memoria]: `find` captura el filtro; `createQueryBuilder` devuelve 0 líneas (→ blockers completos)
function setup() {
  const songs = { find: jest.fn(async () => [song]) };
  const qb = {
    select: () => qb,
    addSelect: () => qb,
    where: () => qb,
    groupBy: () => qb,
    getRawMany: async () => [],
  };
  const lines = { createQueryBuilder: () => qb };
  const uc = new ListSongsUseCase(songs as never, {} as never, lines as never);
  const where = () => (songs.find.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;
  return { uc, where };
}

describe('ListSongsUseCase · mine', () => {
  it('ADMIN: todas las canciones en cualquier estado, con lo que les falta', async () => {
    const { uc, where } = setup();
    const out = await uc.execute({ id: 'admin', role: 'ADMIN' }, { mine: true });
    expect(where()).toEqual({ withdrawnAt: IsNull() }); // Sin createdBy ni status
    expect(out[0].blockers).toEqual(['license', 'lyrics']);
  });

  it('TEACHER: solo las suyas, borradores incluidos', async () => {
    const { uc, where } = setup();
    await uc.execute({ id: 't1', role: 'TEACHER' }, { mine: true });
    expect(where()).toEqual({ withdrawnAt: IsNull(), createdBy: 't1' });
  });

  it('USER: «mine» no abre borradores (solo publicadas)', async () => {
    const { uc, where } = setup();
    const out = await uc.execute({ id: 'u1', role: 'USER' }, { mine: true });
    expect(where()).toEqual({ withdrawnAt: IsNull(), status: 'published' });
    expect(out[0].blockers).toBeUndefined();
  });
});
