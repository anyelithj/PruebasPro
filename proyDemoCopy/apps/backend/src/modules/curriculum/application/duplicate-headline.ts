import { ConflictException } from '@nestjs/common';
import type { CefrLevel } from '../../../shared/domain/cefr-level.vo';
import type { Language } from '../../../shared/domain/language.vo';
import { headline, headlineText } from '../domain/headline';
import type { ICurriculumRepository } from '../domain/interfaces/curriculum.repository.interface';
import type { CurriculumItemKind } from '../domain/value-objects/curriculum-item-kind.vo';
// [Regla anti-duplicados de Recursos · 2026-10-28]: un tema admite VARIOS elementos (palabras, reglas, frases…) pero no dos con el mismo titular normalizado
// en el mismo idioma + nivel + tipo + tema (la clave natural solo comparaba el slug, y una clave manual distinta colaba el mismo contenido) → 409 con mensaje claro
// [Patrón]: Specification (ámbito) + Guard Clause | [Principio]: DRY (alta y edición) + Fail Fast | [Paradigma]: Funcional + async/await
const SCOPE_LIMIT = 100; // = tope de página del repositorio (search acota a 100) → temas más grandes se comparan con sus 100 primeros elementos (la clave natural sigue protegiendo el resto)

export async function assertNoDuplicateHeadline(
  repo: ICurriculumRepository,
  scope: {
    language: Language;
    level: CefrLevel;
    kind: CurriculumItemKind;
    topic: string;
    content: Record<string, unknown>;
  },
  excludeId?: string,
): Promise<void> {
  const text = headlineText(scope.content).trim();
  if (!text) return; // Sin titular reconocible no hay con qué comparar (tipos como rúbrica sin título)
  const key = headline(scope.content);
  const { data } = await repo.search({
    language: scope.language,
    level: scope.level,
    kind: scope.kind,
    topic: scope.topic.trim(),
    page: 1,
    limit: SCOPE_LIMIT,
  });
  const dup = data.find((i) => i.id !== excludeId && headline(i.content) === key);
  if (dup)
    throw new ConflictException({
      message: `Ya existe «${headlineText(dup.content) || text}» en el tema «${dup.topic}» (mismo idioma, nivel y tipo). Edita el existente o cambia el contenido.`,
      code: 'DUPLICATE_TITLE', // Mismo código que la regla de títulos del resto de módulos (shared/application/unique-title)
    });
}
