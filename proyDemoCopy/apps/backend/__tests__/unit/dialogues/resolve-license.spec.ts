// [Test resolveLicense · 2026-10-27]: los datos de derechos solo se exigen al texto IMPORTADO (de terceros); lo generado con IA o escrito por el docente
// nace como «obra propia» publicable | [Patrón]: Unit Test de función pura | [Principio]: Fail Fast (importado sin licencia → 400 antes de guardar)
import { BadRequestException } from '@nestjs/common';
import { OWN_HOLDER, resolveLicense } from '../../../src/modules/dialogues/application/use-cases/upload-dialogue.use-case';
import { licenseProblem } from '../../../src/modules/music/domain/value-objects/license.vo';

describe('resolveLicense (diálogos)', () => {
  it.each(['ai', 'own', undefined] as const)('origen %s sin licencia → obra propia publicable', (origin) => {
    const l = resolveLicense({ origin });
    expect(l).toMatchObject({ type: 'own_work', holder: OWN_HOLDER, confirmed: true });
    expect(licenseProblem(l)).toBeNull(); // Se podrá publicar (ConfirmDialogueLevel valida la licencia)
  });

  it('importado sin titular ni confirmación → 400', () => {
    expect(() => resolveLicense({ origin: 'import', license: { type: 'creative_commons', source: 'https://x.test', holder: '', confirmed: false } })).toThrow(BadRequestException);
  });

  it('importado con licencia válida → se conserva', () => {
    const license = { type: 'public_domain' as const, source: 'https://x.test', holder: 'Esopo', confirmed: true };
    expect(resolveLicense({ origin: 'import', license })).toBe(license);
  });
});
