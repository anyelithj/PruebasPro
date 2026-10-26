// [Spec target-language + groupLoneSentences · 2026-10-25]: detectar respuestas en español con idioma meta ≠ es y reintentar · agrupar frases sueltas en párrafos
import { inTargetLanguage, looksSpanish } from '../../../src/shared/domain/target-language';
import { groupLoneSentences } from '../../../src/modules/reading/infrastructure/ai/reading-draft-client.adapter';

describe('looksSpanish', () => {
  it('detecta español y no confunde inglés ni francés', () => {
    expect(looksSpanish('¿Qué animal es este? Los gatos son silenciosos en la noche.')).toBe(true);
    expect(looksSpanish('What animal is this? Cats are quiet at night.')).toBe(false);
    expect(looksSpanish('Le chat est sur la table et il dort.')).toBe(false);
  });
});

describe('inTargetLanguage', () => {
  it('reintenta en modo estricto solo si salió en español', async () => {
    const run = jest.fn(async (strict: boolean) => (strict ? 'The cat is black and the dog is white.' : 'El gato es negro y el perro es blanco.'));
    expect(await inTargetLanguage('en', run, (x) => x)).toBe('The cat is black and the dog is white.');
    expect(run).toHaveBeenCalledTimes(2);
    const es = jest.fn(async () => 'El gato es negro y el perro es blanco.');
    await inTargetLanguage('es', es, (x) => x);
    expect(es).toHaveBeenCalledTimes(1);
  });
});

describe('groupLoneSentences', () => {
  it('agrupa de 3 en 3 cuando casi todo son frases sueltas', () => {
    expect(groupLoneSentences(['A.', 'B.', 'C.', 'D.', 'E.'])).toEqual(['A. B. C.', 'D. E.']);
  });
  it('respeta párrafos reales', () => {
    const real = ['One. Two.', 'Three. Four.', 'Five. Six.', 'Seven. Eight.'];
    expect(groupLoneSentences(real)).toEqual(real);
  });
});
