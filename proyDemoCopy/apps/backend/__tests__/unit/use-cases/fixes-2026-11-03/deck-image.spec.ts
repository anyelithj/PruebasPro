import { cleanItems } from '../../../../src/modules/games/application/use-cases/game-decks.use-case';
// [Suite 2026-11-03]: imagen por palabra del juego (miniatura data:image como vocabulario, o https) | nada ejecutable

describe('cleanItems · image', () => {
  it('acepta miniatura WebP y https; descarta javascript:, svg y demasiado grande', () => {
    const items = cleanItems([
      { term: 'der Kopf', image: 'data:image/webp;base64,UklGRhIAAABXRUJQ' },
      { term: 'die Hand', image: 'https://upload.wikimedia.org/hand.png' },
      { term: 'das Bein', image: 'javascript:alert(1)' },
      { term: 'der Fuß', image: 'data:image/svg+xml;base64,PHN2Zz4=' },
      { term: 'das Ohr', image: `data:image/webp;base64,${'A'.repeat(150_001)}` },
    ]);
    expect(items.map((i) => !!i.image)).toEqual([true, true, false, false, false]);
  });
});
