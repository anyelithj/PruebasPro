import {
  Points,
  InvalidPointsError,
} from '../../../src/modules/score/domain/value-objects/points.vo';

describe('Points (Value Object)', () => {
  describe('create', () => {
    it('crea puntos validos', () => {
      expect(Points.create(10).value).toBe(10);
    });

    it('permite cero', () => {
      expect(Points.create(0).value).toBe(0);
    });

    it('redondea valores decimales', () => {
      expect(Points.create(10.4).value).toBe(10);
      expect(Points.create(10.6).value).toBe(11);
    });

    it.each([-1, -0.5, NaN, Infinity, -Infinity])(
      'rechaza valor invalido: %p',
      (v) => {
        expect(() => Points.create(v)).toThrow(InvalidPointsError);
      },
    );
  });

  describe('add', () => {
    it('suma dos Points', () => {
      expect(Points.create(5).add(Points.create(7)).value).toBe(12);
    });

    it('es inmutable: no muta los operandos', () => {
      const a = Points.create(5);
      const b = Points.create(7);
      a.add(b);
      expect(a.value).toBe(5);
      expect(b.value).toBe(7);
    });
  });

  describe('equals', () => {
    it('compara por valor', () => {
      expect(Points.create(5).equals(Points.create(5))).toBe(true);
      expect(Points.create(5).equals(Points.create(6))).toBe(false);
    });
  });
});
