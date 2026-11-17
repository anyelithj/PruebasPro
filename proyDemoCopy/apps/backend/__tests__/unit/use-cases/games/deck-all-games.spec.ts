import {
  StartGameSessionUseCase,
  gapOf,
} from '../../../../src/modules/games/application/use-cases/start-game-session.use-case';
import { deckPromptFor } from '../../../../src/modules/games/application/use-cases/game-decks.use-case';

// [2026-11-11]: juegos del docente para TODOS los tipos (tabú, temas, escucha, role-play) + tema elegido del banco
const deck = (gameType: string, items: object[]) => ({ id: 'd1', gameType, title: 'En el mercado', language: 'en', level: 'A2', items, archivedAt: null });
const make = (d: unknown) =>
  new StartGameSessionUseCase(
    { create: (x: unknown) => x, save: async (x: unknown) => x } as never,
    { find: async () => [] } as never,
    { findOneBy: async () => null } as never,
    { findOneBy: async () => d } as never,
  );

describe('Juegos con material propio en todos los tipos', () => {
  it('tabú usa la tarjeta y las prohibidas del mazo', async () => {
    const s = await make(deck('taboo', [{ term: 'apple', words: 'fruit, red , tree' }])).execute('u', { gameType: 'taboo', language: 'en', deckId: 'd1' });
    expect(s.content.target).toBe('apple');
    expect(s.content.forbidden).toEqual(['fruit', 'red', 'tree']);
  });

  it('debate usa un tema del mazo', async () => {
    const s = await make(deck('debate', [{ term: 'Cats are better than dogs' }])).execute('u', { gameType: 'debate', language: 'en', deckId: 'd1' });
    expect(s.content.topic).toBe('Cats are better than dogs');
  });

  it('dictado usa las frases del mazo con la palabra más larga oculta', async () => {
    const s = await make(deck('partial_dictation', [{ term: 'I buy fruit at the supermarket.' }])).execute('u', { gameType: 'partial_dictation', language: 'en', deckId: 'd1' });
    expect(s.content.lines?.[0]).toMatchObject({ text: 'I buy fruit at the supermarket.', gap: 'supermarket' });
  });

  it('role-play convierte cada ítem en un objetivo con palabras clave', async () => {
    const s = await make(deck('role_play', [{ term: 'Pide el precio', words: 'How much, price' }])).execute('u', { gameType: 'role_play', language: 'en', deckId: 'd1' });
    expect(s.content.objectives).toEqual([{ id: 'g1', text: 'Pide el precio', keywords: ['how much', 'price'] }]);
    expect(s.content.role).toBe('En el mercado');
  });

  it('el tema elegido del banco se respeta', async () => {
    const s = await make(null).execute('u', { gameType: 'debate', language: 'en', theme: 'Remote work is the future' });
    expect(s.content.topic).toBe('Remote work is the future');
  });

  it('gapOf y prompts por familia', () => {
    expect(gapOf('Hello, wonderful world!')).toBe('wonderful');
    expect(deckPromptFor('taboo', 'English', 5, 'A2', 'x').join(' ')).toContain('"words"');
    expect(deckPromptFor('quick_qa', 'English', 5, 'A2', 'x').join(' ')).toContain('"question"');
  });
});
