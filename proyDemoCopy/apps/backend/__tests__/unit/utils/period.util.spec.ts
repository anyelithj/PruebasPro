import {
  ALLOWED_PERIOD_MONTHS,
  parsePeriodMonths,
  monthsToSince,
} from '../../../src/shared/utils/period.util';

// [Suite period.util]: filtro de periodo (2/3/6/12 meses) para analíticas | [Corrección]: filtros por periodo

describe('parsePeriodMonths', () => {
  it('acepta los periodos soportados', () => {
    for (const m of ALLOWED_PERIOD_MONTHS) {
      expect(parsePeriodMonths(String(m))).toBe(m);
    }
  });

  it('rechaza valores no soportados → undefined (sin filtro)', () => {
    expect(parsePeriodMonths('5')).toBeUndefined();
    expect(parsePeriodMonths('0')).toBeUndefined();
    expect(parsePeriodMonths('abc')).toBeUndefined();
    expect(parsePeriodMonths('')).toBeUndefined();
    expect(parsePeriodMonths(undefined)).toBeUndefined();
  });
});

describe('monthsToSince', () => {
  it('undefined / 0 → sin fecha de corte', () => {
    expect(monthsToSince(undefined)).toBeUndefined();
    expect(monthsToSince(0)).toBeUndefined();
  });

  it('N meses → fecha pasada coherente con la ventana', () => {
    const since = monthsToSince(3);
    expect(since).toBeInstanceOf(Date);
    const now = Date.now();
    // [Ventana ~3 meses]: entre 2 y 4 meses atrás (tolerancia por días del mes)
    const diffDays = (now - (since as Date).getTime()) / 86_400_000;
    expect(diffDays).toBeGreaterThan(55);
    expect(diffDays).toBeLessThan(130);
  });
});
