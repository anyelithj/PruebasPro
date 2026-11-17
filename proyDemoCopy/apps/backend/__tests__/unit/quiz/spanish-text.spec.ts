import { looksSpanish } from '../../../src/modules/quiz/domain/spanish-text';

describe('looksSpanish', () => {
  it('detecta un enunciado en español y deja pasar el alemán', () => {
    expect(looksSpanish('¿Qué adjetivo comparativo se usa después del verbo?')).toBe(true);
    expect(looksSpanish('El libro es más interesante que el otro')).toBe(true);
    expect(looksSpanish('Welches Adjektiv passt: Das Haus ist ___ als das andere.', 'größer', 'groß')).toBe(false);
  });
});
