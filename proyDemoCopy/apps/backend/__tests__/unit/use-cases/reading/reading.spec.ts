import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { ReadingAccess } from '../../../../src/modules/reading/application/use-cases/reading-access';
import { needsEnrichment, ReadingContentWriter } from '../../../../src/modules/reading/application/use-cases/reading-content.writer';
import { ListReadingTextsUseCase } from '../../../../src/modules/reading/application/use-cases/list-reading-texts.use-case';
import { SaveReadingProgressUseCase } from '../../../../src/modules/reading/application/use-cases/reading-progress.use-case';
import { ENRICH_BATCH, SentenceEnricher } from '../../../../src/modules/reading/application/use-cases/sentence-enricher';
import { publishProblem, UpdateReadingTextUseCase } from '../../../../src/modules/reading/application/use-cases/update-reading-text.use-case';
import type { ReadingProgress } from '../../../../src/modules/reading/domain/entities/reading-progress.entity';
import type { ReadingSentence } from '../../../../src/modules/reading/domain/entities/reading-sentence.entity';
import type { ReadingText } from '../../../../src/modules/reading/domain/entities/reading-text.entity';
import { fileName, groupParagraphs, toTxt } from '../../../../src/modules/reading/domain/reading-export';
import { isReadingGenre, ReadingGenre } from '../../../../src/modules/reading/domain/reading-genre';
import { buildSentences, chunkLong, countWords, splitParagraphs, splitSentences } from '../../../../src/modules/reading/domain/sentence-splitter';
import { paragraphsOf, parseLoose } from '../../../../src/modules/reading/infrastructure/ai/reading-draft-client.adapter';
import { readingPdf } from '../../../../src/modules/reading/infrastructure/export/reading-pdf';
import type { LanguageToolsPort, LinesResult } from '../../../../src/shared/domain/interfaces/language-tools.interface';
// [Suite Lectura · 2026-10-25]: división en frases, normalización del JSON de la IA, enriquecimiento por lotes con fallos parciales, reutilización de traducciones al editar, permisos, publicación, marcador y exportación | [Patrón]: Test Double (repositorios y puertos en memoria) | [Herramienta]: Jest

const TEXT = (over: Partial<ReadingText> = {}): ReadingText =>
  ({ id: 't1', title: 'The Fox', language: 'en', level: 'A2', genre: ReadingGenre.FABLE, topic: null, summary: null, status: 'draft', source: 'manual', sourceRef: null, sentenceCount: 0, wordCount: 0, createdBy: 'teacher-1', withdrawnAt: null, createdAt: new Date(), updatedAt: new Date(), ...over }) as ReadingText;

// [toolsStub]: LanguageToolsPort en memoria — `failOn` hace fallar el lote cuyo primer texto coincide
function toolsStub(failOn?: string) {
  const calls: string[][] = [];
  const lines = jest.fn(async (texts: string[]): Promise<LinesResult> => {
    calls.push(texts);
    if (failOn && texts.includes(failOn)) throw new Error('LLM ocupado');
    return { engine: 'stub', needs_native_review: false, lines: texts.map((t, index) => ({ index, text: t, ipa: `ipa(${t})`, ipa_us: null, translation: `es(${t})` })) };
  });
  return { port: { lines } as unknown as LanguageToolsPort, calls, lines };
}

describe('SentenceSplitter', () => {
  it('separa frases sin cortar abreviaturas ni iniciales', () => {
    expect(splitSentences('Mr. Smith met Dr. Brown. They talked! Did J. K. Rowling come? Yes.', 'en')).toEqual([
      'Mr. Smith met Dr. Brown.',
      'They talked!',
      'Did J. K. Rowling come?',
      'Yes.',
    ]);
  });

  it('respeta los signos de apertura del español y las comillas de cierre', () => {
    expect(splitSentences('Hola, Sra. Pérez. ¿Cómo está? «Bien», dijo ella. ¡Qué día!', 'es')).toEqual(['Hola, Sra. Pérez.', '¿Cómo está?', '«Bien», dijo ella.', '¡Qué día!']);
  });

  it('chino: corta en 。！？ sin espacios', () => {
    expect(splitSentences('我喜欢猫。你呢？很好！', 'zh')).toEqual(['我喜欢猫。', '你呢？', '很好！']);
  });

  it('alemán: un ordinal no cierra la frase', () => {
    expect(splitSentences('Wir treffen uns am 3. Mai im Park. Das ist schön.', 'de')).toEqual(['Wir treffen uns am 3. Mai im Park.', 'Das ist schön.']);
  });

  it('párrafos por línea en blanco; en verso se conservan los saltos', () => {
    expect(splitParagraphs('Uno\ndos.\r\n\r\nTres.')).toEqual(['Uno dos.', 'Tres.']);
    expect(splitParagraphs('Roses are red\nViolets are blue\n\nSugar is sweet', true)).toEqual(['Roses are red\nViolets are blue', 'Sugar is sweet']);
  });

  it('buildSentences numera párrafo y posición global; el poema va verso a verso', () => {
    const s = buildSentences(['Roses are red\nViolets are blue', 'Sugar is sweet'], 'en', true);
    expect(s.map((x) => [x.paragraph, x.position, x.text])).toEqual([
      [0, 0, 'Roses are red'],
      [0, 1, 'Violets are blue'],
      [1, 2, 'Sugar is sweet'],
    ]);
  });

  it('trocea frases demasiado largas entre palabras y cuenta palabras', () => {
    const parts = chunkLong(Array.from({ length: 30 }, () => 'word').join(' '), 50);
    expect(parts.every((p) => p.length <= 50)).toBe(true);
    expect(parts.join(' ').split(' ')).toHaveLength(30);
    expect(countWords("It's a cat-like fox.", 'en')).toBe(4);
    expect(countWords('我喜欢猫。', 'zh')).toBe(4);
  });
});

describe('Borrador de la IA (normalización del JSON)', () => {
  it('parseLoose acepta JSON con texto o vallas alrededor', () => {
    expect(parseLoose('```json\n{"title":"X"}\n```')).toEqual({ title: 'X' });
    expect(parseLoose('nada')).toBeNull();
    expect(parseLoose('[1,2]')).toBeNull();
  });

  it('paragraphsOf tolera cadenas, objetos, listas de versos y un único texto', () => {
    expect(paragraphsOf({ paragraphs: ['A  b.', { text: 'C.' }, ''] }, false)).toEqual(['A b.', 'C.']);
    expect(paragraphsOf({ stanzas: [['v1', 'v2']] }, true)).toEqual(['v1\nv2']);
    expect(paragraphsOf({ story: 'Uno.\n\nDos.' }, false)).toEqual(['Uno.', 'Dos.']);
    expect(paragraphsOf({}, false)).toEqual([]);
  });

  it('géneros: type guard', () => {
    expect(isReadingGenre('poem')).toBe(true);
    expect(isReadingGenre('novel')).toBe(false);
  });
});

describe('SentenceEnricher (lotes con fallo parcial)', () => {
  it('un lote que falla deja vacías solo sus frases', async () => {
    const texts = Array.from({ length: ENRICH_BATCH + 3 }, (_, i) => `s${i}`);
    const { port, calls } = toolsStub(`s${ENRICH_BATCH}`); // Falla el segundo lote
    const { items, failed } = await new SentenceEnricher(port).enrich(texts, 'en', 'tok');
    expect(calls).toHaveLength(2);
    expect(failed).toBe(3);
    expect(items[0]).toEqual({ ipa: 'ipa(s0)', ipaUs: null, translation: 'es(s0)' });
    expect(items[ENRICH_BATCH]).toEqual({ ipa: '', ipaUs: null, translation: null });
  });
});

describe('ReadingContentWriter', () => {
  // [repo en memoria]: create = identidad · transaction ejecuta el callback con un EntityManager falso
  function writerWith(port: LanguageToolsPort) {
    const saved: { texts: ReadingText[]; sentences: ReadingSentence[] } = { texts: [], sentences: [] };
    const em = {
      delete: jest.fn(async () => undefined),
      save: jest.fn(async (_cls: unknown, v: unknown) => {
        if (Array.isArray(v)) saved.sentences = v as ReadingSentence[];
        else saved.texts.push(v as ReadingText);
        return v;
      }),
    };
    const repo = { create: (x: Partial<ReadingSentence>) => x as ReadingSentence, manager: { transaction: (fn: (m: typeof em) => unknown) => fn(em) } } as unknown as Repository<ReadingSentence>;
    return { writer: new ReadingContentWriter(repo, new SentenceEnricher(port)), saved, em };
  }

  it('divide, enriquece y actualiza contadores en una transacción', async () => {
    const { port } = toolsStub();
    const { writer, saved, em } = writerWith(port);
    const text = TEXT();
    const res = await writer.write(text, ['The fox runs. It is fast.'], 'tok');
    expect(res.sentences.map((s) => s.text)).toEqual(['The fox runs.', 'It is fast.']);
    expect(res.pending).toBe(0);
    expect(text.sentenceCount).toBe(2);
    expect(text.wordCount).toBe(6);
    expect(em.delete).toHaveBeenCalled();
    expect(saved.sentences[1]!.translation).toBe('es(It is fast.)');
  });

  it('al editar reutiliza traducción/IPA (y la revisión) de las frases sin cambios', async () => {
    const { port, calls } = toolsStub();
    const { writer } = writerWith(port);
    const previous = [{ text: 'The fox runs.', ipa: 'ðə fɒks', ipaUs: null, translation: 'El zorro corre (revisada).', reviewed: true }] as ReadingSentence[];
    const res = await writer.write(TEXT(), ['The fox runs. A new line.'], 'tok', previous);
    expect(calls).toEqual([['A new line.']]); // Solo la nueva va a FastAPI
    expect(res.sentences[0]).toMatchObject({ translation: 'El zorro corre (revisada).', reviewed: true });
    expect(res.sentences[1]).toMatchObject({ translation: 'es(A new line.)', reviewed: false });
  });

  it('needsEnrichment: falta IPA o traducción (salvo español)', () => {
    expect(needsEnrichment({ ipa: '', translation: 'x' }, 'en')).toBe(true);
    expect(needsEnrichment({ ipa: 'a', translation: null }, 'en')).toBe(true);
    expect(needsEnrichment({ ipa: 'a', translation: null }, 'es')).toBe(false);
  });
});

describe('ReadingAccess y lista', () => {
  const repoOf = (t: ReadingText | null) => ({ findOneBy: jest.fn(async () => t) }) as unknown as Repository<ReadingText>;
  const student = { id: 'u1', role: 'USER' };
  const owner = { id: 'teacher-1', role: 'TEACHER' };
  const other = { id: 'teacher-2', role: 'TEACHER' };

  it('el estudiante no ve borradores (404); sí publicados', async () => {
    await expect(new ReadingAccess(repoOf(TEXT())).readable(student, 't1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(new ReadingAccess(repoOf(TEXT({ status: 'published' }))).readable(student, 't1')).resolves.toMatchObject({ id: 't1' });
  });

  it('solo el autor o un ADMIN editan', async () => {
    await expect(new ReadingAccess(repoOf(TEXT())).editable(other, 't1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(new ReadingAccess(repoOf(TEXT())).editable(owner, 't1')).resolves.toBeTruthy();
    await expect(new ReadingAccess(repoOf(TEXT())).editable({ id: 'x', role: 'ADMIN' }, 't1')).resolves.toBeTruthy();
  });

  it('lista: publicados para el estudiante aunque pida mine; propios para el docente; todos para el ADMIN', async () => {
    const find = jest.fn(async (_opts: { where: object }) => [] as ReadingText[]);
    const uc = new ListReadingTextsUseCase({ find } as unknown as Repository<ReadingText>);
    await uc.execute(student, { mine: true, genre: 'poem' });
    expect(find.mock.calls[0]![0]).toMatchObject({ where: { status: 'published', genre: 'poem' } });
    await uc.execute(owner, { mine: true });
    expect(find.mock.calls[1]![0]).toMatchObject({ where: { createdBy: 'teacher-1' } });
    await uc.execute({ id: 'a', role: 'ADMIN' }, { mine: true });
    expect(find.mock.calls[2]![0].where).not.toHaveProperty('createdBy');
    expect(find.mock.calls[2]![0].where).not.toHaveProperty('status');
  });
});

describe('Publicación y marcador', () => {
  it('publishProblem exige frases y título', () => {
    expect(publishProblem({ sentenceCount: 0, title: 'Ok' })).toMatch(/frases/);
    expect(publishProblem({ sentenceCount: 3, title: 'Ok' })).toBeNull();
  });

  it('no publica una lectura vacía', async () => {
    const t = TEXT();
    const access = { editable: jest.fn(async () => t) } as unknown as ReadingAccess;
    const uc = new UpdateReadingTextUseCase(access, { save: jest.fn(async (x: ReadingText) => x) } as unknown as Repository<ReadingText>, {} as Repository<ReadingSentence>, {} as ReadingContentWriter);
    await expect(uc.status(owner(), 't1', 'published')).rejects.toBeInstanceOf(BadRequestException);
    t.sentenceCount = 4;
    await expect(uc.status(owner(), 't1', 'published')).resolves.toMatchObject({ status: 'published' });
  });

  it('el marcador se acota a la última frase y «terminada» no se pierde', async () => {
    const access = { readable: jest.fn(async () => TEXT({ status: 'published', sentenceCount: 5 })) } as unknown as ReadingAccess;
    const upsert = jest.fn(async () => undefined);
    const repo = { findOneBy: jest.fn(async () => ({ finished: true }) as ReadingProgress), upsert } as unknown as Repository<ReadingProgress>;
    const res = await new SaveReadingProgressUseCase(access, repo).execute({ id: 'u1', role: 'USER' }, 't1', { sentence: 99, word: 2 });
    expect(res).toEqual({ sentence: 4, word: 2, finished: true });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', textId: 't1', sentenceIndex: 4 }), { conflictPaths: ['userId', 'textId'] });
  });
});

describe('Exportar (TXT y PDF)', () => {
  const sentences = [
    { paragraph: 0, text: 'The fox runs.', translation: 'El zorro corre.', ipa: 'ðə fɒks rʌnz' },
    { paragraph: 0, text: 'It is fast.', translation: 'Es rápido.', ipa: 'ɪt ɪz fɑːst' },
    { paragraph: 1, text: 'The end.', translation: 'Fin.', ipa: 'ðiː end' },
  ];
  const t = { title: 'The Fox', language: 'en', level: 'A2', genre: ReadingGenre.FABLE, summary: null, sourceRef: null };

  it('agrupa por párrafo', () => {
    expect(groupParagraphs(sentences).map((p) => p.length)).toEqual([2, 1]);
  });

  it('TXT con traducción e IPA bajo cada frase; sin partes → párrafo corrido', () => {
    const full = toTxt(t, sentences, ['translation', 'ipa']);
    expect(full).toContain('Fábula · EN · A2');
    expect(full).toContain('The fox runs.\n  IPA: /ðə fɒks rʌnz/\n  ES: El zorro corre.');
    expect(toTxt(t, sentences, [])).toContain('The fox runs. It is fast.\n\nThe end.');
  });

  it('nombre de archivo seguro y PDF declarativo con la cabecera', () => {
    expect(fileName('¿Qué día, Señor?', 'pdf')).toBe('Que-dia-Senor.pdf');
    const doc = readingPdf(t, sentences, ['translation']);
    expect(doc.info?.title).toBe('The Fox');
    expect(JSON.stringify(doc.content)).toContain('El zorro corre.');
    expect(JSON.stringify(doc.content)).not.toContain('ðə');
  });
});

function owner() {
  return { id: 'teacher-1', role: 'TEACHER' };
}
