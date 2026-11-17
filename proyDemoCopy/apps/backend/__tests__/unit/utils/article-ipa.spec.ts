import { leadingArticle, withArticleIpa } from '../../../src/shared/domain/article-ipa';
// [Suite article-ipa · 2026-11-06]: la pronunciación incluye el artículo que se muestra (der Hund → /deːɐ̯ ˈhʊnt/)

describe('withArticleIpa', () => {
  it('antepone el artículo y conserva las barras', () => {
    expect(withArticleIpa('de', 'der Hund', '/ˈhʊnt/')).toBe('/deːɐ̯ ˈhʊnt/');
    expect(withArticleIpa('es', 'la casa', 'ˈkasa')).toBe('la ˈkasa');
    expect(withArticleIpa('fr', "l'eau", '/o/')).toBe('/lo/');
  });
  it('no duplica si el IPA ya trae el artículo', () => {
    expect(withArticleIpa('de', 'der Hund', '/deːɐ̯ ˈhʊnt/')).toBe('/deːɐ̯ ˈhʊnt/');
    expect(withArticleIpa('de', 'die Katze', '/diː ˈkat͡sə/')).toBe('/diː ˈkat͡sə/');
  });
  it('sin artículo, sin IPA o idioma sin tabla → igual', () => {
    expect(withArticleIpa('de', 'Hund', '/ˈhʊnt/')).toBe('/ˈhʊnt/');
    expect(withArticleIpa('de', 'der Hund', null)).toBeNull();
    expect(withArticleIpa('ru', 'собака', '/sɐˈbakə/')).toBe('/sɐˈbakə/');
    expect(leadingArticle('en', 'the')).toBeNull(); // una sola palabra no es «artículo + sustantivo»
  });
});
