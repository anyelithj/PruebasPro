import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CefrLevel } from '../../../src/shared/domain/cefr-level.vo';
import { Language } from '../../../src/shared/domain/language.vo';
import { LanguageSkill } from '../../../src/shared/domain/language-skill.vo';
import { CERTIFICATIONS, certificationsFor } from '../../../src/modules/curriculum/domain/certifications';
import { CurriculumItemKind } from '../../../src/modules/curriculum/domain/value-objects/curriculum-item-kind.vo';
import { CertificationPracticeQuery } from '../../../src/modules/curriculum/application/queries/certification-practice.query';

// [Suite Etapa 5 · Certificaciones]: catálogo coherente y práctica con ítems originales

describe('Catálogo de certificaciones', () => {
  it('cubre los 7 idiomas de la plataforma con ids únicos y un examen por nivel', () => {
    expect(new Set(CERTIFICATIONS.map((c) => c.language))).toEqual(new Set(Object.values(Language)));
    expect(new Set(CERTIFICATIONS.map((c) => c.id)).size).toBe(CERTIFICATIONS.length);
    for (const c of CERTIFICATIONS) expect(new Set(c.levels.map((l) => l.cefr)).size).toBe(c.levels.length);
  });

  it('marca como orientativa la equivalencia MCER no oficial (HSK, Celpe-Bras)', () => {
    expect(certificationsFor(Language.ZH)[0].cefrMapping).toBe('approximate');
    expect(certificationsFor(Language.PT)[0].cefrMapping).toBe('approximate');
    expect(certificationsFor(Language.ES)[0]).toMatchObject({ id: 'dele', cefrMapping: 'official' });
  });
});

describe('CertificationPracticeQuery', () => {
  const draft = { strategy: 'llm', llmRequired: true, content: {}, drafts: [{ content: {} }] };
  const make = () => {
    const drafts = { execute: jest.fn().mockResolvedValue(draft) };
    return { drafts, query: new CertificationPracticeQuery(drafts as never) };
  };
  const input = { level: CefrLevel.B1, skill: LanguageSkill.READING, kind: CurriculumItemKind.EXERCISE, count: 3 };

  it('genera con el idioma de la certificación, un tema propio y la instrucción de originalidad', async () => {
    const { drafts, query } = make();
    const res = await query.execute('dele', input, 'u1');
    const call = drafts.execute.mock.calls[0][0];
    expect(call).toMatchObject({ language: Language.ES, level: CefrLevel.B1, topic: 'Preparación DELE B1 · Comprensión lectora', count: 3 });
    expect(call.guidance).toMatch(/ORIGINALES.*no reproduzcas/);
    expect(res).toMatchObject({ exam: 'DELE B1', certification: { id: 'dele' } });
    expect(res.notice).toMatch(/no son preguntas oficiales/);
  });

  it('rechaza certificación inexistente, nivel sin examen o competencia no evaluada', async () => {
    const { query } = make();
    await expect(query.execute('toefl-x', input, 'u1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(query.execute('cambridge', { ...input, level: CefrLevel.A1 }, 'u1')).rejects.toBeInstanceOf(BadRequestException); // Cambridge empieza en A2
    await expect(query.execute('hsk', { ...input, skill: LanguageSkill.SPEAKING }, 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('avisa que la equivalencia MCER es orientativa cuando no es oficial', async () => {
    const { query } = make();
    const res = await query.execute('hsk', { ...input, level: CefrLevel.A2 }, 'u1');
    expect(res.notice).toMatch(/orientativa/);
  });
});
