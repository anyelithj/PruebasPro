import { TestBed } from '@angular/core/testing';
import { from, of, throwError } from 'rxjs';
import { AssistantRepository } from '@features/assistant/domain/assistant.repository.port';
import type { ChatChunk, ConversationDetail, ConversationSummary } from '@features/assistant/domain/models/assistant';
import { AssistantFacade } from '@features/assistant/application/assistant.facade';
// [Spec AssistantFacade]: enviar → turno del usuario + turno del tutor que crece token a token, sesión recordada, error que quita el turno vacío
// + [2026-10-28] evento `saved` (ids + uso del idioma), renombrar, eliminar conversación, editar y eliminar mensaje | [Patrón]: Test Double (repositorio falso)

const SUMMARY: ConversationSummary = {
  id: 'c1', title: 'Presente simple', language: 'en', level: 'A2', createdAt: '2026-10-28T10:00:00Z', updatedAt: '2026-10-28T10:00:00Z',
  languageUsage: { language: 'en', level: 'A2', ratio: 0.25, target: 0.4, words: 4, target_words: 1, turns: 1, announced: true, below: true },
};
const DETAIL: ConversationDetail = {
  ...SUMMARY,
  messages: [
    { id: 'm1', role: 'user', content: 'I play football', createdAt: SUMMARY.createdAt, editedAt: SUMMARY.createdAt },
    { id: 'm2', role: 'assistant', content: '✓ Bien', createdAt: SUMMARY.createdAt, editedAt: null },
  ],
};

function setup(stream: AssistantRepository['stream'], extra: Partial<AssistantRepository> = {}) {
  TestBed.configureTestingModule({ providers: [AssistantFacade, { provide: AssistantRepository, useValue: { stream, ...extra } }] });
  return TestBed.inject(AssistantFacade);
}

describe('AssistantFacade', () => {
  it('construye la respuesta con los tokens y guarda la sesión', () => {
    const chunks: ChatChunk[] = [{ type: 'session', sessionId: 's-1' }, { type: 'token', text: 'Hola ' }, { type: 'token', text: 'Ana' }, { type: 'done' }];
    const calls: unknown[] = [];
    const facade = setup((input) => (calls.push(input), from(chunks)));
    facade.send('  ¿Qué es el present perfect?  ');
    expect(facade.turns()).toEqual([
      { role: 'user', content: '¿Qué es el present perfect?' },
      { role: 'assistant', content: 'Hola Ana' },
    ]);
    expect(facade.sessionId()).toBe('s-1');
    expect(facade.streaming()).toBe(false);
    facade.send('Otra');
    expect(calls[1]).toMatchObject({ sessionId: 's-1', language: 'en' });
  });

  it('un error quita los dos turnos (no se guardaron), devuelve el texto al editor y lo informa', () => {
    const facade = setup(() => throwError(() => new Error('El tutor no está disponible')));
    facade.send('Hola');
    expect(facade.turns()).toEqual([]);
    expect(facade.unsent()).toBe('Hola');
    expect(facade.error()).toBe('El tutor no está disponible');
  });

  it('`saved` pone los ids reales, el uso del idioma y sube la conversación en la lista', () => {
    const saved = { conversation: SUMMARY, userMessage: DETAIL.messages[0]!, assistantMessage: DETAIL.messages[1]! };
    const facade = setup(() => from<ChatChunk[]>([{ type: 'session', sessionId: 'c1' }, { type: 'token', text: '✓ Bien' }, { type: 'saved', saved }, { type: 'done' }]));
    facade.send('I play football');
    expect(facade.turns().map((t) => t.id)).toEqual(['m1', 'm2']);
    expect(facade.usage()?.below).toBe(true);
    expect(facade.goal()).toBe(0.4);
    expect(facade.conversations()[0]?.id).toBe('c1');
  });

  it('meta por defecto = tabla espejo del nivel hasta la primera medición', () => {
    const facade = setup(() => from([]));
    facade.level.set('B2');
    expect(facade.goal()).toBe(0.75);
  });

  it('renombrar, editar, eliminar mensaje y eliminar conversación', async () => {
    const rename = jest.fn(() => of({ ...SUMMARY, title: 'Nuevo' }));
    const get = jest.fn(() => of(DETAIL));
    const editMessage = jest.fn(() => of(DETAIL));
    const deleteMessage = jest.fn(() => of({ ...DETAIL, messages: [] }));
    const remove = jest.fn(() => of(undefined));
    const facade = setup(() => from([]), { rename, get, editMessage, deleteMessage, remove } as never);
    await facade.open('c1');
    expect(facade.turns()).toHaveLength(2);
    expect(await facade.rename('c1', '  Nuevo ')).toBe(true);
    expect(rename).toHaveBeenCalledWith('c1', 'Nuevo');
    expect(facade.conversations()[0]?.title).toBe('Nuevo');
    expect(await facade.editMessage('m1', 'I play tennis')).toBe(true);
    expect(editMessage).toHaveBeenCalledWith('c1', 'm1', 'I play tennis');
    expect(await facade.deleteMessage('m2')).toBe(true);
    expect(facade.turns()).toEqual([]);
    expect(await facade.remove('c1')).toBe(true);
    expect(facade.conversations()).toEqual([]);
    expect(facade.sessionId()).toBeUndefined();
  });

  it('un fallo de CRUD deja el error y devuelve false', async () => {
    const facade = setup(() => from([]), { rename: () => throwError(() => new Error('Conversación no encontrada')) } as never);
    expect(await facade.rename('x', 'Y')).toBe(false);
    expect(facade.error()).toBe('Conversación no encontrada');
    expect(facade.busy()).toBe(false);
  });

  it('mensaje vacío no se envía; reset limpia todo', () => {
    const facade = setup(() => from([]));
    facade.send('   ');
    expect(facade.isEmpty()).toBe(true);
    facade.send('x');
    facade.reset();
    expect(facade.isEmpty()).toBe(true);
    expect(facade.sessionId()).toBeUndefined();
  });
});
