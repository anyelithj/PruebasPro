import { clausesOf } from '../../../src/modules/books/domain/clauses';
// [Spec clausesOf · 2026-11-16]: renglones cortos para la IPA renglón a renglón del lector de libros

describe('clausesOf', () => {
  it('corta antes de «which» en una frase larga y no antes de un «that» temprano', () => {
    expect(
      clausesOf(
        'You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings.',
      ),
    ).toEqual([
      'You will rejoice to hear that no disaster has accompanied the commencement of an enterprise',
      'which you have regarded with such evil forebodings.',
    ]);
  });

  it('corta tras la coma si el trozo es largo; frase corta queda entera', () => {
    expect(
      clausesOf(
        'I am already far north of London, and as I walk in the streets',
      ),
    ).toEqual([
      'I am already far north of London,',
      'and as I walk in the streets',
    ]);
    expect(clausesOf('Yes, sir.')).toEqual(['Yes, sir.']);
  });

  // [2026-11-17]: renglón largo sin coma ni conector a tiempo → se parte cerca de la mitad, antes de «to»
  it('parte un renglón de más de 16 palabras', () => {
    expect(
      clausesOf(
        'and may regulate a thousand celestial observations that require only this voyage to render their seeming eccentricities consistent for ever.',
      ),
    ).toEqual([
      'and may regulate a thousand celestial observations that require only this voyage',
      'to render their seeming eccentricities consistent for ever.',
    ]);
  });
});
