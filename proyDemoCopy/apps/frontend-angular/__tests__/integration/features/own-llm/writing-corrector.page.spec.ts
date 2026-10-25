import { of, throwError } from 'rxjs';
import { render, settle } from '@testing/render';
import { expectAllNamed, getByRole } from '@testing/a11y';
import { OwnLlmFacade } from '@features/own-llm/application/own-llm.facade';
import { OwnLlmRepository } from '@features/own-llm/domain/own-llm.repository.port';
import { segmentText, type WritingCorrection } from '@features/own-llm/domain/models/own-llm';
import WritingCorrectorPage from '@features/own-llm/presentation/pages/writing-corrector.page';
// [Spec WritingCorrectorPage]: validación del formulario (Signal Forms), resultado con errores marcados navegables, aviso de respaldo y error | [Patrón]: Test Double del puerto + regla pura segmentText

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
const providers = (correct: OwnLlmRepository['correct']) => [OwnLlmFacade, { provide: OwnLlmRepository, useValue: { correct, scope: () => of({ languages: ['en'], levels: ['A1'], max_text_length: 2000 }) } }];

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
    getByRole(el, 'button', 'Corregir').click();
    await settle(fixture);
    expect(getByRole(el, 'alert').textContent).toContain('al menos 3');
    expect(el.querySelector('textarea')!.getAttribute('aria-describedby')).toBe('writing-text-error');
    expect(correct).not.toHaveBeenCalled();
  });

  it('muestra errores marcados, corrección y aviso de modelo base', async () => {
    const correct = jest.fn(() => of(result));
    const { fixture, el } = await render(WritingCorrectorPage, providers(correct));
    await write(el, TEXT);
    await settle(fixture);
    getByRole(el, 'button', 'Corregir').click();
    await settle(fixture);
    expect(correct).toHaveBeenCalledWith({ text: TEXT, language: 'en', level: 'A2' }); // Inglés por defecto; el selector ofrece los 7 idiomas
    const mark = getByRole(el, 'button', 'Gramática: «goed» → «went»');
    mark.click();
    await settle(fixture);
    expect(mark.getAttribute('aria-pressed')).toBe('true');
    expect(el.textContent).toContain('I went to school yesterday');
    expect(el.textContent).toContain('modelo base');
    expectAllNamed(el);
  });

  it('7 idiomas: elegir francés y C1 los envía al corrector', async () => {
    const correct = jest.fn(() => of(result));
    const { el, fixture } = await render(WritingCorrectorPage, providers(correct));
    const lang = el.querySelector('#writing-language') as HTMLSelectElement;
    expect(lang.options).toHaveLength(7);
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
    getByRole(el, 'button', 'Corregir').click();
    await settle(fixture);
    expect(getByRole(el, 'alert').textContent).toContain('Corrector no disponible');
  });
});
