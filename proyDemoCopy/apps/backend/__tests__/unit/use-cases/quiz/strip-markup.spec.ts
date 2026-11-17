import { stripMarkup } from '../../../../src/modules/quiz/application/use-cases/generate-ai-questions.use-case';
// [2026-11-11]: el modelo dejaba «<text>…</text>» en el enunciado y se veía en el examen

describe('stripMarkup', () => {
  it('quita etiquetas y espacios sobrantes; respeta el texto y los signos', () => {
    expect(stripMarkup('<text>¿Cuál es el plural de «Kind»?</text>')).toBe('¿Cuál es el plural de «Kind»?');
    expect(stripMarkup('Ich <b>habe</b>  gegessen <br/>')).toBe('Ich habe gegessen');
    expect(stripMarkup('3 < 5 y 7 > 2')).toBe('3 < 5 y 7 > 2');
  });
});
