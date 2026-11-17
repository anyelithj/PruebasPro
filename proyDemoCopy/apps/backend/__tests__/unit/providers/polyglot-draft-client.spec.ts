import { cleanConcepts } from '../../../src/modules/polyglot/infrastructure/ai/polyglot-draft-client.adapter';
// [Suite cleanConcepts · 2026-10-31]: casos reales del tema «El clima» → significado repetido y término en otro alfabeto | [Patrón]: Test de función pura | [Herramienta]: Jest

const concept = (gloss: string, terms: Record<string, string>) => ({ gloss, terms });

describe('cleanConcepts', () => {
  it('quita significados repetidos, sin distinguir tildes ni mayúsculas', () => {
    const out = cleanConcepts([concept('viento', { en: 'wind' }), concept('Viénto ', { en: 'breeze' }), concept('lluvia', { en: 'rain' })]);
    expect(out.map((c) => c.gloss)).toEqual(['viento', 'lluvia']);
  });

  it('no repite los significados que el tema ya tiene', () => {
    expect(cleanConcepts([concept('sol', { en: 'sun' }), concept('nieve', { en: 'snow' })], ['Sol']).map((c) => c.gloss)).toEqual(['nieve']);
  });

  it('deja como hueco el término escrito en otro alfabeto', () => {
    const [c] = cleanConcepts([concept('nieve', { en: 'snow', ru: 'сnow', zh: 'snow', es: 'nieve' })]);
    expect(c.terms).toEqual({ en: 'snow', es: 'nieve' });
  });

  it('conserva alfabetos correctos con signos y acentos', () => {
    const terms = { fr: 'S’il vous plaît', de: 'Gern geschehen', pt: 'água', ru: 'Не за что', zh: '不客气' };
    expect(cleanConcepts([concept('de nada', terms)])[0].terms).toEqual(terms);
  });
});
