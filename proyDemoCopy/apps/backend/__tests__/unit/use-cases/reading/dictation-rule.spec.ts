import { dictationProblem } from '../../../../src/modules/reading/domain/sentence-splitter';
// [Spec dictationProblem · 2026-11-16]: un dictado necesita ≥ 3 párrafos de ≥ 5 frases (igual que una lectura generada)

const para = (n: number) =>
  Array.from({ length: n }, (_, i) => `This is sentence number ${i + 1}.`).join(
    ' ',
  );

describe('dictationProblem', () => {
  it('3 párrafos de 5 frases → válido', () => {
    expect(dictationProblem([para(5), para(5), para(6)], 'en')).toBeNull();
  });
  it('2 párrafos → pide 3', () => {
    expect(dictationProblem([para(5), para(5)], 'en')).toMatch(
      /al menos 3 párrafos/,
    );
  });
  it('un párrafo corto → dice cuál', () => {
    expect(dictationProblem([para(5), para(3), para(5)], 'en')).toMatch(
      /párrafo 2/,
    );
  });
});

// [2026-11-16]: el borrador de IA de un dictado pide solo el mínimo (3 × 5–6) → cabe en el plazo del modelo local
import { dictationShape, minSentences, rebalance } from '../../../../src/modules/reading/infrastructure/ai/reading-draft-client.adapter';
describe('dictationShape', () => {
  it('pide 6–7 frases por párrafo pero exige 5 sin tolerancia (3 × 5 = 15)', () => {
    expect(dictationShape('C2')).toEqual({ paragraphs: 3, sentences: [6, 7], words: 300, strictMin: 5 });
    expect(minSentences(dictationShape('A1'))).toBe(15);
  });

  it('reparte 4+4+4+3 frases en 3 párrafos de 5 (antes quedaban párrafos de 4 «bien formados»)', () => {
    const p = (n: number, k: number) => Array.from({ length: n }, (_, i) => `Sentence ${k}${i} is here.`).join(' ');
    const out = rebalance([p(4, 1), p(4, 2), p(4, 3), p(3, 4)], 'en', dictationShape('A1'), false);
    expect(out.map((x) => x.split('. ').length)).toEqual([5, 5, 5]);
  });
});

// [2026-11-17]: con strictMin ningún párrafo queda bajo el mínimo (antes 14 frases → 5,5,4 y 23 → 6,6,6,5 con párrafos de 4 si llegaban mal formados)
describe('rebalance (dictado)', () => {
  const p = (n: number, k: number) => Array.from({ length: n }, (_, i) => `Sentence ${k}${i} is here.`).join(' ');
  const sizes = (out: string[]) => out.map((x) => x.split('. ').length);
  it('14 frases → 2 párrafos de 7 (nunca uno de 4; la continuación pide el tercero)', () => {
    expect(sizes(rebalance([p(5, 1), p(5, 2), p(4, 3)], 'en', dictationShape('A1'), false))).toEqual([7, 7]);
  });
  it('23 frases en 5 párrafos de 4–5 → todos ≥ 5', () => {
    const out = rebalance([p(4, 1), p(4, 2), p(5, 3), p(6, 4), p(4, 5)], 'en', dictationShape('B1'), false);
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...sizes(out))).toBeGreaterThanOrEqual(5);
  });
});
