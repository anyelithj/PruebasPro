import type { JwtService } from '@nestjs/jwt';
import type { AssistantClientService } from '../../../src/modules/ai/assistant-client.service';
import { WordMarkedToLearnEvent } from '../../../src/modules/vocabulary/domain/events/word-marked-to-learn.event';
import { UserWordsIndexListener } from '../../../src/modules/vocabulary/infrastructure/ai/user-words-index.listener';
// [Spec UserWordsIndex · RF-137 · 2026-11-14]: marcar «aprender» → SOLO esa palabra al RAG, con token a nombre del usuario · fallo → no rompe

describe('UserWordsIndexListener', () => {
  const setup = (fail = false) => {
    const entry = {
      id: 'e1',
      userId: 'u1',
      language: 'en',
      term: 'lighthouse',
      translation: 'faro',
    };
    const entries = {
      findOne: jest.fn(({ where }: { where: { id: string; userId: string } }) =>
        Promise.resolve(
          where.id === 'e1' && where.userId === 'u1' ? entry : null,
        ),
      ),
    };
    const indexUserWords = jest.fn(() =>
      fail
        ? Promise.reject(new Error('caído'))
        : Promise.resolve({ indexed: 1 }),
    );
    const signAsync = jest.fn(() => Promise.resolve('tok'));
    const listener = new UserWordsIndexListener(
      entries as never,
      { indexUserWords } as unknown as AssistantClientService,
      { signAsync } as unknown as JwtService,
      { accessSecret: 's' } as never,
    );
    return { listener, indexUserWords, signAsync };
  };

  it('envía solo la palabra y su traducción con el usuario como sujeto del token', async () => {
    const { listener, indexUserWords, signAsync } = setup();
    await listener.handle(new WordMarkedToLearnEvent('u1', 'e1'));
    expect(signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'u1' }),
      expect.anything(),
    );
    expect(indexUserWords).toHaveBeenCalledWith(
      [{ id: 'e1', language: 'en', term: 'lighthouse', translation: 'faro' }],
      'tok',
    );
  });

  it('palabra de otro usuario → nada; FastAPI caído → no lanza', async () => {
    const { listener, indexUserWords } = setup();
    await listener.handle(new WordMarkedToLearnEvent('u2', 'e1'));
    expect(indexUserWords).not.toHaveBeenCalled();
    await expect(
      setup(true).listener.handle(new WordMarkedToLearnEvent('u1', 'e1')),
    ).resolves.toBeUndefined();
  });
});
