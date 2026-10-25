import { DEFAULT_ORDER, move, normalize, reorder, toggle } from '@features/polyglot/domain/language-order';
// [Spec language-order · Sprint 10.7 · RF-129/RF-131]: español siempre al final salvo que el usuario lo mueva; agregar respeta el orden por defecto; nunca queda una tabla sin columnas | [Paradigma]: funciones puras (sin TestBed)

describe('language-order', () => {
  it('por defecto: inglés, alemán, francés, portugués, ruso, chino y español al final', () => {
    expect(DEFAULT_ORDER).toEqual(['en', 'de', 'fr', 'pt', 'ru', 'zh', 'es']);
    expect(normalize([])).toEqual([...DEFAULT_ORDER]);
    expect(normalize(['es', 'xx', 'en', 'es'])).toEqual(['es', 'en']);
  });

  it('toggle agrega en su posición por defecto (español al final) y no deja la tabla vacía', () => {
    expect(toggle(['en', 'ru'], 'es')).toEqual(['en', 'ru', 'es']);
    expect(toggle(['en', 'es'], 'de')).toEqual(['en', 'de', 'es']);
    expect(toggle(['en', 'de'], 'de')).toEqual(['en']);
    expect(toggle(['en'], 'en')).toEqual(['en']);
  });

  it('el usuario puede mover el español (con botones o arrastrando)', () => {
    expect(move(['en', 'es'], 'es', -1)).toEqual(['es', 'en']);
    expect(move(['en', 'es'], 'en', -1)).toEqual(['en', 'es']); // Borde: sin cambio
    expect(reorder(['en', 'de', 'es'], 2, 0)).toEqual(['es', 'en', 'de']);
  });
});
