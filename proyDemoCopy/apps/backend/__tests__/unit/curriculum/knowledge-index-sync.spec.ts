// [Tests KnowledgeIndexSync · Tarea 9 · RF-57/RF-139]: el cambio de un recurso (manual, archivo o enlace) llega al índice RAG en lote, con token de servicio y fail-soft
// [Patrón]: Test Double (stubs de AssistantClient y JwtService) | [Tecnología]: Jest
import { KnowledgeIndexSyncListener } from '../../../src/modules/curriculum/infrastructure/ai/knowledge-index-sync.listener';
import { CurriculumItemsChangedEvent } from '../../../src/modules/curriculum/domain/events/curriculum-items-changed.event';

const make = (sync = jest.fn().mockResolvedValue({ indexed: 1, removed: [], size: 1 })) => {
  const jwt = { signAsync: jest.fn().mockResolvedValue('svc-token') };
  // `as never` (TS): los dobles solo implementan lo que el listener usa
  const listener = new KnowledgeIndexSyncListener({ syncKnowledge: sync } as never, jwt as never, { accessSecret: 's' } as never);
  return { listener, sync, jwt };
};

describe('KnowledgeIndexSyncListener', () => {
  afterEach(() => jest.useRealTimers());

  it('junta los eventos seguidos en UNA petición sin ids repetidos (publicar un tema completo)', async () => {
    jest.useFakeTimers();
    const { listener, sync, jwt } = make();
    listener.handle(new CurriculumItemsChangedEvent(['a', 'b'], 'teacher-1'));
    listener.handle(new CurriculumItemsChangedEvent(['b', 'c'], 'teacher-1'));
    await listener.flush();
    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith(['a', 'b', 'c'], 'svc-token');
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({ sub: 'teacher-1', role: 'TEACHER' }), expect.objectContaining({ expiresIn: 120 }));
  });

  it('una baja (actor null) también se envía → su fragmento sale del índice', async () => {
    const { listener, sync } = make();
    listener.handle(new CurriculumItemsChangedEvent(['borrado'], null));
    await listener.flush();
    expect(sync).toHaveBeenCalledWith(['borrado'], 'svc-token');
  });

  it('fail-soft: si FastAPI no responde no lanza (el recurso ya quedó guardado)', async () => {
    const { listener } = make(jest.fn().mockRejectedValue(new Error('down')));
    listener.handle(new CurriculumItemsChangedEvent(['x'], 't'));
    await expect(listener.flush()).resolves.toBeUndefined();
  });

  it('sin cambios pendientes no llama a FastAPI', async () => {
    const { listener, sync } = make();
    await listener.flush();
    expect(sync).not.toHaveBeenCalled();
  });
});
