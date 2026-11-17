import { diffWords, dictationScore } from '@features/reading/domain/models/dictation';
// [Spec Dictation · 2026-11-16]: comparación palabra por palabra del dictado (sin contar mayúsculas ni puntuación)

describe('diffWords', () => {
  it('frase igual (mayúsculas y signos no cuentan) → todo bien y 100 %', () => {
    const d = diffWords('The cat is black.', 'the cat is black');
    expect(d.every((t) => t.kind === 'ok')).toBe(true);
    expect(dictationScore(d)).toBe(100);
  });

  it('marca palabra mal escrita, la que falta y la que sobra', () => {
    const d = diffWords('The cat is very black', 'The kat is black today');
    expect(d).toEqual([
      { kind: 'ok', text: 'The' },
      { kind: 'wrong', text: 'kat', expected: 'cat' },
      { kind: 'ok', text: 'is' },
      { kind: 'missing', text: 'very' },
      { kind: 'ok', text: 'black' },
      { kind: 'extra', text: 'today' },
    ]);
    expect(dictationScore(d)).toBe(50); // 3 bien de 5 esperadas − 0,5 por la que sobra
  });

  it('nada escrito → 0 %', () => {
    expect(dictationScore(diffWords('Hola mundo', ''))).toBe(0);
  });
});
