import { headline, textKey } from '../../../src/modules/curriculum/domain/headline';
// [Bug 2026-10-23]: el vocabulario chino tenía clave '' (slug latino vacío) → todos los elementos parecían repetidos

describe('textKey / headline', () => {
  it('distingue palabras chinas y conserva el slug latino', () => {
    expect(textKey('苹果')).not.toBe(textKey('香蕉'));
    expect(textKey('苹果')).not.toBe('');
    expect(textKey('Café')).toBe('cafe');
    expect(headline({ lemma: '红色' })).not.toBe(headline({ lemma: '白色' }));
  });
});
