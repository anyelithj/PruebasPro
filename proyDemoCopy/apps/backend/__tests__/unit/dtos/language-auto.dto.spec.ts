import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TranslateTextDto } from '../../../src/modules/vocabulary/application/dtos/vocabulary-entry.dto';
import { WritingCorrectionBody } from '../../../src/modules/ai/own-llm.controller';

// [Suite «Detectar idioma» · 2026-10-27]: el Traductor y el Corrector aceptan 'auto' como idioma de origen; el resto sigue cerrado a los 7 idiomas | [Patrón]: Table-driven tests (`it.each`)

const errorsOf = async <T extends object>(
  cls: new () => T,
  body: object,
  field: string,
) =>
  (await validate(plainToInstance(cls, body))).filter(
    (e) => e.property === field,
  );

describe('TranslateTextDto · source', () => {
  it.each(['auto', 'en', 'zh'])('acepta %p', async (source) => {
    expect(
      await errorsOf(
        TranslateTextDto,
        { source, target: 'es', text: 'hello' },
        'source',
      ),
    ).toHaveLength(0);
  });

  it.each(['it', '', 'AUTO'])('rechaza %p', async (source) => {
    expect(
      await errorsOf(
        TranslateTextDto,
        { source, target: 'es', text: 'hello' },
        'source',
      ),
    ).toHaveLength(1);
  });

  it('el destino no admite «auto»', async () => {
    expect(
      await errorsOf(
        TranslateTextDto,
        { source: 'auto', target: 'auto', text: 'hello' },
        'target',
      ),
    ).toHaveLength(1);
  });
});

describe('WritingCorrectionBody · language', () => {
  it.each(['auto', 'fr'])('acepta %p', async (language) => {
    expect(
      await errorsOf(
        WritingCorrectionBody,
        { text: 'I goed home', language, level: 'B1' },
        'language',
      ),
    ).toHaveLength(0);
  });

  it('rechaza idiomas fuera de alcance', async () => {
    expect(
      await errorsOf(
        WritingCorrectionBody,
        { text: 'Ciao a tutti', language: 'it', level: 'B1' },
        'language',
      ),
    ).toHaveLength(1);
  });
});
