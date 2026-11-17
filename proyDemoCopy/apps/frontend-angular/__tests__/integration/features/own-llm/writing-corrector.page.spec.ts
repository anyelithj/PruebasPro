import { of, throwError } from 'rxjs';
import { render, settle } from '@testing/render';
import { expectAllNamed, getByRole } from '@testing/a11y';
import { OwnLlmFacade } from '@features/own-llm/application/own-llm.facade';
import { OwnLlmRepository } from '@features/own-llm/domain/own-llm.repository.port';
import { acceptAll, acceptFinding, ignoreFinding, segmentText, startReview, type WritingCorrection } from '@features/own-llm/domain/models/own-llm';
import WritingCorrectorPage from '@features/own-llm/presentation/pages/writing-corrector.page';
// [Spec WritingCorrectorPage]: validación del formulario (Signal Forms), resultado con errores marcados navegables, aviso de respaldo y error | [Patrón]: Test Double del puerto + regla pura segmentText
// [2026-10-27 · Estilo GrammarMama]: «Detectar idioma» por defecto y contador
// [2026-10-28]: editor SIEMPRE editable · «Original (errores resaltados)» + «Texto corregido» (escuchar/Copiar/usar) + «Explicaciones» con categoría en español

const TEXT = 'I goed to school yesterday';
const result: WritingCorrection = {
  findings: [{ type: 'grammar', original: 'goed', correction: 'went', explanation_es: 'Pasado irregular de «go».', start: 2, end: 6 }],
  corrected_text: 'I went to school yesterday',
  explanation_es: 'Un error de tiempo verbal.',
  model_used: 'qwen2.5:3b',
  fallback_used: true,
  latency_ms: 812,
  flags: ['REQUIERE_REVISION'],
};
const providers = (correct: OwnLlmRepository['correct']) => [OwnLlmFacade, { provide: OwnLlmRepository, useValue: { correct, detect: () => of('en'), scope: () => of({ languages: ['en'], levels: ['A1'], max_text_length: 2000 }) } }];

async function write(el: HTMLElement, text: string) {
  const area = el.querySelector('textarea')!;
  area.value = text;
  area.dispatchEvent(new Event('input'));
  area.dispatchEvent(new Event('blur'));
}

describe('WritingCorrectorPage', () => {
  it('segmentText marca solo hallazgos con posición válida', () => {
    expect(segmentText(TEXT, result.findings)).toEqual([
      { text: 'I ', finding: null },
      { text: 'goed', finding: 0 },
      { text: ' to school yesterday', finding: null },
    ]);
    expect(segmentText('abc', [{ ...result.findings[0]!, start: 1, end: 99 }])).toEqual([{ text: 'abc', finding: null }]);
  });

  it('texto demasiado corto → error asociado al campo y no se envía', async () => {
    const correct = jest.fn(() => of(result));
    const { fixture, el } = await render(WritingCorrectorPage, providers(correct));
    await write(el, 'Hi');
    getByRole(el, 'button', 'Comprobar').click();
    await settle(fixture);
    expect(getByRole(el, 'alert').textContent).toContain('al menos 3');
    expect(el.querySelector('textarea')!.getAttribute('aria-describedby')).toBe('writing-text-error');
    expect(correct).not.toHaveBeenCalled();
  });

  it('muestra errores marcados, corrección y sin aviso de modelo base', async () => {
    const correct = jest.fn(() => of(result));
    const { fixture, el } = await render(WritingCorrectorPage, providers(correct));
    await write(el, TEXT);
    await settle(fixture);
    getByRole(el, 'button', 'Comprobar').click();
    await settle(fixture);
    expect(correct).toHaveBeenCalledWith({ text: TEXT, language: 'auto', level: 'A2' }); // [2026-10-27]: «Detectar idioma» por defecto
    const mark = getByRole(el, 'button', 'Gramática: «goed» → «went»');
    mark.click();
    await settle(fixture);
    expect(mark.getAttribute('aria-pressed')).toBe('true');
    expect(el.textContent).toContain('I went to school yesterday');
    expect(el.textContent).not.toContain('modelo base');
    // [Fix 2026-10-28]: el editor sigue ahí y se puede borrar sin pulsar «Editar»
    const area = el.querySelector('textarea')!;
    expect(area.value).toBe(TEXT);
    await write(el, '');
    await settle(fixture);
    expect(area.value).toBe('');
    expectAllNamed(el);
  });

  it('7 idiomas: elegir francés y C1 los envía al corrector', async () => {
    const correct = jest.fn(() => of(result));
    const { el, fixture } = await render(WritingCorrectorPage, providers(correct));
    const lang = el.querySelector('#writing-language') as HTMLSelectElement;
    expect(lang.options).toHaveLength(8); // «Detectar idioma» + los 7 idiomas
    expect(lang.options[0]!.textContent).toContain('Detectar idioma');
    lang.value = 'fr';
    lang.dispatchEvent(new Event('input')); // [formField] (Signal Forms) escucha «input» también en <select>
    const level = el.querySelector('#writing-level') as HTMLSelectElement;
    level.value = 'C1';
    level.dispatchEvent(new Event('input'));
    await write(el, 'Je allez au cinéma');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(correct).toHaveBeenCalledWith({ text: 'Je allez au cinéma', language: 'fr', level: 'C1' });
  });

  it('error del servicio', async () => {
    const { fixture, el } = await render(WritingCorrectorPage, providers(() => throwError(() => new Error('Corrector no disponible'))));
    await write(el, TEXT);
    await settle(fixture);
    getByRole(el, 'button', 'Comprobar').click();
    await settle(fixture);
    expect(getByRole(el, 'alert').textContent).toContain('Corrector no disponible');
  });

  it('estilo GrammarMama: idioma detectado junto al selector, original resaltado, texto corregido y explicaciones con categoría', async () => {
    const two: WritingCorrection = {
      ...result,
      findings: [
        { type: 'spelling', original: 'i m', correction: "I'm", explanation_es: "La contracción de 'I am' necesita apóstrofo: 'I'm'.", start: 0, end: 3 },
        { type: 'capitalization', original: 'ana', correction: 'Ana', explanation_es: 'Los nombres propios se escriben con mayúscula inicial.', start: 4, end: 7 },
      ],
      corrected_text: "I'm Ana",
      language: 'en',
      detected_language: 'en',
    };
    const correct = jest.fn(() => of(two));
    const { fixture, el } = await render(WritingCorrectorPage, providers(correct));
    await write(el, 'i m ana');
    await settle(fixture);
    getByRole(el, 'button', 'Comprobar').click();
    await settle(fixture);
    expect(el.textContent).toContain('2 errores');
    // La insignia vive en la misma fila que el selector de idioma
    const badge = getByRole(el, 'status');
    expect(badge.textContent).toContain('Detectado: Inglés');
    expect(badge.parentElement?.querySelector('#writing-language')).not.toBeNull();
    const headings = [...el.querySelectorAll('h2')].map((h) => h.textContent?.trim());
    expect(headings).toEqual(expect.arrayContaining(['Original (errores resaltados)', 'Texto corregido', 'Explicaciones']));
    expect(getByRole(el, 'button', 'Mayúsculas: «ana» → «Ana»').textContent?.trim()).toBe('ana');
    const items = [...el.querySelectorAll('ol li')].map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
    expect(items[1]).toContain('ana → Ana');
    expect(items[1]).toContain('Mayúsculas');
    expect(items[1]).toContain('Los nombres propios');
    expect(getByRole(el, 'button', 'Escuchar el texto corregido: I\'m Ana')).toBeTruthy();
    // «Usar en el editor» → el texto corregido pasa al textarea, que sigue editable
    getByRole(el, 'button', 'Reemplazar el texto del editor por el texto corregido').click();
    await settle(fixture);
    expect(el.querySelector('textarea')!.value).toBe("I'm Ana");
    // «Borrar texto» vacía editor y resultado
    getByRole(el, 'button', 'Borrar texto').click();
    await settle(fixture);
    expect(el.querySelector('textarea')!.value).toBe('');
    expect(el.textContent).not.toContain('Explicaciones');
    expectAllNamed(el);
  });

  it('reglas puras: aceptar desplaza, borrar se lleva un espacio, aceptar todas aplica de atrás hacia delante', () => {
    const text = 'I very like the the pizza';
    const review = startReview(text, [
      { type: 'word_order', original: 'very', correction: '', explanation_es: 'x', start: 2, end: 6 },
      { type: 'grammar', original: 'the', correction: '', explanation_es: 'x', start: 16, end: 19 },
      { type: 'spelling', original: 'pizza', correction: 'pizzas', explanation_es: 'x', start: 20, end: 25 },
      { type: 'grammar', original: 'piz', correction: 'p', explanation_es: 'solapado', start: 20, end: 23 }, // Solapado → descartado
      { type: 'grammar', original: '?', correction: '!', explanation_es: 'sin posición', start: null, end: null },
    ]);
    expect(review.findings).toHaveLength(3);
    const one = acceptFinding(review, 0);
    expect(one.text).toBe('I like the the pizza');
    expect(one.findings.map((f) => [f.start, f.end])).toEqual([[11, 14], [15, 20]]);
    expect(one.text.slice(15, 20)).toBe('pizza');
    expect(ignoreFinding(one, 0).findings).toHaveLength(1);
    expect(acceptAll(review)).toEqual({ text: 'I like the pizzas', findings: [] });
  });
});
