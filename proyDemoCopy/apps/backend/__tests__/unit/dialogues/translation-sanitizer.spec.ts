import { sanitizeTranslation } from '../../../src/modules/dialogues/domain/translation-sanitizer';
// [Spec sanitizeTranslation · 2026-10-25]: cadenas EXACTAS del reporte de «Temas de conversación» (JSON crudo y «yes» → «yes») | [Patrón]: AAA | [Principio]: función pura, sin Nest

describe('sanitizeTranslation', () => {
  const meat =
    'I like ground meat spicy, with vegetables served in little tacos.';

  it('desenvuelve el JSON con la frase como clave', () => {
    const raw = `{"${meat}": "Me gusta la carne molida picante, con verduras servidas en taquitos."}`;
    expect(sanitizeTranslation(meat, raw)).toBe(
      'Me gusta la carne molida picante, con verduras servidas en taquitos.',
    );
  });

  it('desenvuelve la lista con coma colgante', () => {
    expect(
      sanitizeTranslation(
        'It includes tomato, red and green peppers…',
        '["Incluye tomate, pimientos rojos y verdes, …",]',
      ),
    ).toBe('Incluye tomate, pimientos rojos y verdes, …');
  });

  it('descarta lo que no es traducción: «yes» → «yes», vacío y JSON roto', () => {
    expect(sanitizeTranslation('yes', 'yes')).toBeNull();
    expect(sanitizeTranslation('Hello', '  ')).toBeNull();
    expect(sanitizeTranslation('Hello', '{"translation": "Hol')).toBeNull();
  });

  it('respeta traducciones normales, nombres propios y corchetes de letras', () => {
    expect(sanitizeTranslation('Bell pepper', 'Pimiento morrón')).toBe(
      'Pimiento morrón',
    );
    expect(sanitizeTranslation('Mexico City', 'Mexico City')).toBe(
      'Mexico City',
    );
    expect(sanitizeTranslation('[Chorus] la la', '[Estribillo] la la')).toBe(
      '[Estribillo] la la',
    );
    expect(sanitizeTranslation('Yes', '{"translation": "Sí"}')).toBe('Sí');
  });
});
