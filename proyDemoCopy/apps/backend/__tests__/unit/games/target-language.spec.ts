// [Spec target-language + groupLoneSentences · 2026-10-25]: detectar respuestas en español con idioma meta ≠ es y reintentar · agrupar frases sueltas en párrafos
import { detectLanguage, inTargetLanguage, looksSpanish, strictLine, wrongLanguage } from '../../../src/shared/domain/target-language';
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

// [2026-10-27]: detector de los 7 idiomas (no solo español) → reintento si el borrador sale en otro idioma
describe('detectLanguage / wrongLanguage', () => {
  it('reconoce escritura (zh/ru) y marcadores latinos con confianza', () => {
    expect(detectLanguage('小狐狸在森林里找朋友。它很高兴。')?.language).toBe('zh');
    expect(detectLanguage('Маленькая лиса живёт в лесу и ищет друзей.')?.language).toBe('ru');
    expect(detectLanguage('The little fox lives in the forest and it is looking for friends with the bear.')).toEqual({ language: 'en', confident: true });
    expect(detectLanguage('Le petit renard est dans la forêt et il cherche des amis avec le loup.')?.language).toBe('fr');
    expect(detectLanguage('hola')).toBeNull();
  });
  it('wrongLanguage: solo con confianza y distinto del meta', () => {
    expect(wrongLanguage('Der kleine Fuchs ist im Wald und er sucht mit dem Bären nicht die Freunde.', 'en')).toBe('de');
    expect(wrongLanguage('The fox is in the forest and the bear is with it.', 'en')).toBeNull();
    expect(wrongLanguage('Fox.', 'fr')).toBeNull();
  });
  it('inTargetLanguage reintenta también si sale en francés y se pidió inglés', async () => {
    const run = jest.fn(async (strict: boolean) => (strict ? 'The cat is on the table and it is sleeping.' : 'Le chat est sur la table et il dort avec le chien.'));
    expect(await inTargetLanguage('en', run, (x) => x)).toBe('The cat is on the table and it is sleeping.');
    expect(run).toHaveBeenCalledTimes(2);
    expect(strictLine('en', 'fr')).toContain('written in French');
  });
});
