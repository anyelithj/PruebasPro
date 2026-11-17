import {
  attemptGate,
  examMinutes,
  expired,
  percentOf,
  pickQuestions,
} from '../../../../src/modules/quiz/domain/exam-rules';
// [Suite exam-rules · 2026-11-06]: 3 intentos, 10 min entre intentos, 24 h tras 3 suspensos (2026-11-11), tiempo total por nivel y sorteo de preguntas

const H = 3600_000;
const M = 60_000;
const now = new Date('2026-11-06T12:00:00Z');
const ago = (ms: number, passed: boolean | null = false) => ({ startedAt: new Date(now.getTime() - ms), passed });

describe('attemptGate', () => {
  it('sin intentos: puede, quedan 3', () => {
    expect(attemptGate([], now)).toEqual({ ok: true, used: 0, left: 3 });
  });
  it('suspenso hace 4 min: espera 10 min desde ese intento', () => {
    const g = attemptGate([ago(4 * M)], now);
    expect(g).toMatchObject({ ok: false, reason: 'wait', left: 2 });
    expect(g.ok === false && g.retryAt!.getTime()).toBe(now.getTime() + 6 * M);
  });
  it('suspenso hace 11 min: puede, quedan 2', () => {
    expect(attemptGate([ago(11 * M)], now)).toEqual({ ok: true, used: 1, left: 2 });
  });
  it('3 suspensos: espera 24 h y luego 3 más', () => {
    const three = [ago(3 * H), ago(2 * H), ago(1 * H)];
    expect(attemptGate(three, now)).toMatchObject({ ok: false, reason: 'wait', left: 0 });
    const later = new Date(now.getTime() + 23 * H);
    expect(attemptGate(three, later)).toEqual({ ok: true, used: 3, left: 3 });
  });
  it('aprobado: no hace falta otro intento', () => {
    expect(attemptGate([ago(30 * H), ago(26 * H, true)], now)).toMatchObject({ ok: false, reason: 'passed' });
  });
});

describe('tiempo, nota y sorteo', () => {
  it('tiempo total por nivel MCER', () => {
    expect([examMinutes('A1'), examMinutes('B2'), examMinutes('C1'), examMinutes(null)]).toEqual([45, 75, 90, 45]);
  });
  it('expira tras el tiempo + 1 min de margen', () => {
    const start = new Date(now.getTime() - 45 * 60_000);
    expect(expired(start, 45, now)).toBe(false);
    expect(expired(start, 45, new Date(now.getTime() + 61_000))).toBe(true);
    expect(expired(start, 0, new Date(now.getTime() + 99 * H))).toBe(false); // 0 = sin límite
  });
  it('% sobre las preguntas del intento (sin contestar = fallo)', () => {
    expect(percentOf(7, 10)).toBe(70);
    expect(percentOf(0, 0)).toBe(0);
  });
  it('sortea n preguntas distintas del banco', () => {
    const bank = Array.from({ length: 20 }, (_, i) => `q${i}`);
    const picked = pickQuestions(bank, 12);
    expect(new Set(picked).size).toBe(12);
    expect(picked.every((id) => bank.includes(id))).toBe(true);
    expect(pickQuestions(bank, 99)).toHaveLength(20);
  });
});
