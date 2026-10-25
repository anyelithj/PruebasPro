import { ForbiddenException } from '@nestjs/common';
import { Language } from '../../../src/shared/domain/language.vo';
import { Role } from '../../../src/modules/users/domain/value-objects/role.vo';
import {
  CONTRADICTION_FLAG,
  draftContradiction,
  findContradictions,
} from '../../../src/modules/curriculum/domain/source-comparison';
import { CurriculumItemKind } from '../../../src/modules/curriculum/domain/value-objects/curriculum-item-kind.vo';
import { ScanContradictionsCommand } from '../../../src/modules/curriculum/application/commands/scan-contradictions.command';

// [Suite Etapa 4 · Multi-fuente]: alineación por titular, especificaciones por campo y bandera CONTRADICCION_DETECTADA

const voc = (id: string, source: string, content: Record<string, unknown>) => ({ id, key: id, source, sourceId: null, content: { lemma: 'Mother', examples: [], ...content } });
const VOC = CurriculumItemKind.VOCABULARY;

describe('findContradictions (dominio)', () => {
  it('detecta una traducción aislada entre fuentes distintas', () => {
    const found = findContradictions(VOC, [voc('a', 'Cambridge', { translationEs: 'madre, mamá' }), voc('b', 'Fuente B', { translationEs: 'padre' })]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ headline: 'mother', field: 'translationEs' });
  });

  it('acepta sinónimos: basta con compartir una alternativa con otra fuente', () => {
    const items = [voc('a', 'Cambridge', { translationEs: 'madre, mamá' }), voc('b', 'B', { translationEs: 'madre' }), voc('c', 'C', { translationEs: 'Mamá' })];
    expect(findContradictions(VOC, items)).toEqual([]);
  });

  it('no compara la IPA entre variantes regionales distintas (en-GB vs en-US)', () => {
    const items = [voc('a', 'A', { ipa: { value: '/ˈmʌðə/', variant: 'en-GB' } }), voc('b', 'B', { ipa: { value: '/ˈmʌðɚ/', variant: 'en-US' } })];
    expect(findContradictions(VOC, items)).toEqual([]);
    const sameVariant = [voc('a', 'A', { ipa: { value: '/ˈmʌðə/', variant: 'en-GB' } }), voc('b', 'B', { ipa: { value: '[ˈmʌðə]', variant: 'en-GB' } })];
    expect(findContradictions(VOC, sameVariant)).toEqual([]); // Barras o corchetes no cambian la transcripción
  });

  it('dos recursos de la MISMA fuente no se contradicen (son duplicados, no fuentes)', () => {
    const items = [voc('a', 'Cambridge', { translationEs: 'madre' }), voc('b', 'cambridge', { translationEs: 'padre' })];
    expect(findContradictions(VOC, items)).toEqual([]);
  });

  it('borrador de IA: not_checked sin pares, detected si choca con lo guardado, none si coincide', () => {
    const stored = [voc('a', 'Cambridge', { translationEs: 'madre' })];
    expect(draftContradiction(VOC, { lemma: 'Father', translationEs: 'padre' }, stored)).toBe('not_checked');
    expect(draftContradiction(VOC, { lemma: 'mother', translationEs: 'padre' }, stored)).toBe('detected');
    expect(draftContradiction(VOC, { lemma: 'Mother', translationEs: 'madre' }, stored)).toBe('none');
  });
});

describe('ScanContradictionsCommand', () => {
  const teacher = { id: 't1', role: Role.TEACHER };

  it('marca los recursos en conflicto y limpia los que ya no lo están (idempotente)', async () => {
    const repo = {
      listForComparison: jest.fn().mockResolvedValue([
        { ...voc('a', 'A', { translationEs: 'madre' }), flags: [] },
        { ...voc('b', 'B', { translationEs: 'padre' }), flags: [] },
        { ...voc('old', 'C', { lemma: 'Apple', translationEs: 'manzana' }), flags: [CONTRADICTION_FLAG] }, // Ya resuelto
      ]),
      setFlag: jest.fn().mockResolvedValue(undefined),
    };
    const res = await new ScanContradictionsCommand(repo as never).execute(Language.EN, VOC, teacher);
    expect(repo.setFlag).toHaveBeenCalledWith(CONTRADICTION_FLAG, ['a', 'b'], ['old']);
    expect(res).toMatchObject({ scanned: 3, flagged: 2, cleared: 1 });
    expect(res.contradictions[0]).toMatchObject({ kind: VOC, field: 'translationEs' });
  });

  it('un estudiante no puede escanear', async () => {
    await expect(new ScanContradictionsCommand({} as never).execute(Language.EN, VOC, { id: 's', role: Role.USER })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
