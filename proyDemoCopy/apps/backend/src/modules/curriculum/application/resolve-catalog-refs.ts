import { BadRequestException } from '@nestjs/common';
import { OWN_CONTENT_SOURCE_SLUG } from '../domain/entities/curriculum-source.entity';
import type { ICurriculumRepository } from '../domain/interfaces/curriculum.repository.interface';
import type { CurriculumItemKind } from '../domain/value-objects/curriculum-item-kind.vo';
import { Provenance } from '../domain/value-objects/provenance.vo';
import type { CefrLevel } from '../../../shared/domain/cefr-level.vo';
import type { Language } from '../../../shared/domain/language.vo';
import type { LanguageSkill } from '../../../shared/domain/language-skill.vo';
// [Resolución de tema y fuente]: deriva topic/key desde el tema y source desde la fuente del catálogo, de forma determinista (sin LLM) | [Paradigma]: Funcional + async/await

export interface CatalogRefsInput {
  topicId?: string;
  sourceId?: string;
  provenance: Provenance;
  language: Language;
  level: CefrLevel;
  skill: LanguageSkill;
  kind: CurriculumItemKind;
}

// Campos del recurso derivados del catálogo (solo los que aplican)
export interface CatalogRefsOutput {
  topicId?: string;
  topic?: string;
  key?: string;
  sourceId?: string | null;
  source?: string | null;
}

export async function resolveCatalogRefs(
  repo: ICurriculumRepository,
  input: CatalogRefsInput,
  options: { sourceTextProvided: boolean }, // Compatibilidad: `source` en texto libre (recursos previos)
): Promise<CatalogRefsOutput> {
  const out: CatalogRefsOutput = {};

  // [Tema]: debe existir y ser compatible con idioma/nivel/competencia (y tipo si el tema lo fija)
  if (input.topicId) {
    const topic = await repo.findTopicById(input.topicId);
    if (!topic) throw new BadRequestException('El tema seleccionado no existe');
    const compatible =
      topic.language === input.language &&
      topic.level === input.level &&
      topic.skill === input.skill &&
      (!topic.kind || topic.kind === input.kind);
    if (!compatible) {
      throw new BadRequestException(
        'El tema no es compatible con el idioma, nivel, competencia o tipo seleccionados',
      );
    }
    out.topicId = topic.id;
    out.topic = topic.name;
    out.key = topic.slug; // Slug determinista del tema → clave del recurso
  }

  // [Fuente]: asociación por id; "Contenido propio" por defecto si la procedencia no es importada
  if (input.sourceId) {
    const source = await repo.findSourceById(input.sourceId);
    if (!source)
      throw new BadRequestException('La fuente seleccionada no existe');
    if (input.provenance === Provenance.IMPORTED && source.isOwnContent) {
      throw new BadRequestException(
        'El contenido importado requiere una fuente externa',
      );
    }
    if (input.provenance === Provenance.MANUAL && !source.isOwnContent) {
      throw new BadRequestException(
        'El contenido manual usa la fuente "Contenido propio"',
      );
    }
    out.sourceId = source.id;
    out.source = source.name;
  } else if (
    input.provenance !== Provenance.IMPORTED &&
    !options.sourceTextProvided
  ) {
    const own = await repo.findSourceBySlug(OWN_CONTENT_SOURCE_SLUG);
    if (own) {
      out.sourceId = own.id;
      out.source = own.name;
    }
  }
  return out;
}
