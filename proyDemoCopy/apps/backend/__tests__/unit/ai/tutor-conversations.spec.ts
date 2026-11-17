import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  TutorConversationService,
  titleFrom,
} from '../../../src/modules/ai/tutor/tutor-conversation.service';
import type { TutorConversation } from '../../../src/modules/ai/tutor/tutor-conversation.entity';
import type { TutorMessage } from '../../../src/modules/ai/tutor/tutor-message.entity';
// [Suite Tutor IA · conversaciones · 2026-10-28]: propiedad (ajena = 404), enviar guarda los dos turnos, editar trunca y regenera, borrar mensaje recalcula el uso del idioma | [Patrón]: Test Double (Stub/Spy de repositorios y de FastAPI) | [Paradigma]: AAA

const NOW = new Date('2026-10-28T10:00:00Z');
const USAGE = { language: 'en', level: 'A2', ratio: 0.5, target: 0.4, words: 4, target_words: 2, turns: 1, announced: true, below: false };

const conv = (over: Partial<TutorConversation> = {}): TutorConversation =>
  ({ id: 'c1', userId: 'u1', title: 'Presente simple', language: 'en', level: 'A2', languageUsage: null, createdAt: NOW, updatedAt: NOW, ...over }) as TutorConversation;
const msg = (seq: number, role: 'user' | 'assistant', content: string): TutorMessage =>
  ({ id: `m${seq}`, conversationId: 'c1', seq, role, content, editedAt: null, createdAt: NOW }) as TutorMessage;

function setup(found: TutorConversation | null, history: TutorMessage[] = []) {
  // `em` (EntityManager doble): `create` devuelve el objeto con fecha · `save` lo devuelve tal cual (array o entidad)
  const em = {
    create: jest.fn((_: unknown, o: object) => ({ id: 'new', createdAt: NOW, ...o })),
    save: jest.fn(async (x: unknown) => x),
    delete: jest.fn(async () => ({ affected: 1 })),
  };
  const conversations = {
    findOne: jest.fn(async ({ where }: { where: { id: string; userId: string } }) => (found && found.id === where.id && found.userId === where.userId ? found : null)),
    find: jest.fn(async () => (found ? [found] : [])),
    create: jest.fn((o: object) => ({ createdAt: NOW, updatedAt: NOW, ...o })),
    save: jest.fn(async (x: unknown) => x),
    delete: jest.fn(async () => ({ affected: 1 })),
    manager: { transaction: jest.fn(async (fn: (e: typeof em) => unknown) => fn(em)) },
  };
  const messages = { find: jest.fn(async () => history), delete: jest.fn(async () => ({ affected: 1 })) };
  const assistant = {
    chat: jest.fn(async () => ({ session_id: 'c1', reply: 'Try: I play football.', history: [], language_usage: USAGE })),
    languageUsage: jest.fn(async () => USAGE),
  };
  const service = new TutorConversationService(conversations as never, messages as never, assistant as never);
  return { service, conversations, messages, assistant, em };
}

describe('TutorConversationService', () => {
  it('titleFrom recorta la primera línea a 60 caracteres', () => {
    expect(titleFrom('  el   presente\nsimple ')).toBe('el presente');
    expect(titleFrom('x'.repeat(80))).toHaveLength(60);
  });

  it('una conversación ajena «no existe» (404) en leer, renombrar, borrar y editar', async () => {
    const { service, conversations, assistant } = setup(conv({ userId: 'otro' }));
    await expect(service.get('u1', 'c1')).rejects.toThrow(NotFoundException);
    await expect(service.rename('u1', 'c1', 'X')).rejects.toThrow(NotFoundException);
    await expect(service.remove('u1', 'c1')).rejects.toThrow(NotFoundException);
    await expect(service.editMessage('u1', 't', 'c1', 'm1', 'hola')).rejects.toThrow(NotFoundException);
    expect(conversations.delete).not.toHaveBeenCalled();
    expect(assistant.chat).not.toHaveBeenCalled();
  });

  it('enviar sin sesión crea la conversación, manda historial vacío y guarda los dos turnos', async () => {
    const { service, assistant, em } = setup(null);
    const r = await service.send('u1', 'tok', { message: 'el presente simple', language: 'en', level: 'A2' });
    expect(assistant.chat).toHaveBeenCalledWith(expect.objectContaining({ message: 'el presente simple', history: [], level: 'A2' }), 'tok');
    expect(r.conversation).toMatchObject({ title: 'el presente simple', languageUsage: USAGE });
    expect([r.userMessage.role, r.assistantMessage.role]).toEqual(['user', 'assistant']);
    expect(em.save).toHaveBeenCalledTimes(2); // conversación + par de mensajes (en una transacción)
  });

  it('si FastAPI falla no se escribe nada', async () => {
    const { service, assistant, conversations } = setup(null);
    assistant.chat.mockRejectedValueOnce(new Error('503'));
    await expect(service.send('u1', 't', { message: 'hola' })).rejects.toThrow('503');
    expect(conversations.manager.transaction).not.toHaveBeenCalled();
  });

  it('editar un mensaje propio trunca lo posterior y regenera con el historial anterior', async () => {
    const history = [msg(1, 'user', 'el presente simple'), msg(2, 'assistant', 'Regla…'), msg(3, 'user', 'yo juego'), msg(4, 'assistant', 'Reescribe…')];
    const { service, assistant, em } = setup(conv(), history);
    await service.editMessage('u1', 't', 'c1', 'm3', 'I play football');
    expect(assistant.chat).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'I play football', history: [{ role: 'user', content: 'el presente simple' }, { role: 'assistant', content: 'Regla…' }] }),
      't',
    );
    expect(em.delete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ conversationId: 'c1' }));
    expect(history[2]).toMatchObject({ content: 'I play football', editedAt: expect.any(Date) });
  });

  it('no se puede editar un mensaje del tutor', async () => {
    const { service, assistant } = setup(conv(), [msg(1, 'user', 'hola'), msg(2, 'assistant', 'Hi!')]);
    await expect(service.editMessage('u1', 't', 'c1', 'm2', 'otro')).rejects.toThrow(BadRequestException);
    expect(assistant.chat).not.toHaveBeenCalled();
  });

  it('borrar un mensaje recalcula el uso del idioma con lo que queda', async () => {
    const { service, messages, assistant } = setup(conv(), [msg(1, 'user', 'hola'), msg(2, 'assistant', 'Hi!')]);
    const r = await service.deleteMessage('u1', 't', 'c1', 'm1');
    expect(messages.delete).toHaveBeenCalledWith({ id: 'm1', conversationId: 'c1' });
    expect(assistant.languageUsage).toHaveBeenCalledWith({ messages: [{ role: 'assistant', content: 'Hi!' }], language: 'en', level: 'A2' }, 't');
    expect(r.languageUsage).toEqual(USAGE);
  });

  it('renombrar rechaza títulos vacíos', async () => {
    const { service } = setup(conv());
    await expect(service.rename('u1', 'c1', '   ')).rejects.toThrow(BadRequestException);
    await expect(service.rename('u1', 'c1', '  Mi   chat ')).resolves.toMatchObject({ title: 'Mi chat' });
  });
});
