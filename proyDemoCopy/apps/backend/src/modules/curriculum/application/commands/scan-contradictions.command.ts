import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Language } from '../../../../shared/domain/language.vo';
import {
  CURRICULUM_REPOSITORY,
  type ICurriculumRepository,
} from '../../domain/interfaces/curriculum.repository.interface';
import {
  COMPARABLE_KINDS,
  CONTRADICTION_FLAG,
  findContradictions,
  type Contradiction,
} from '../../domain/source-comparison';
import type { CurriculumItemKind } from '../../domain/value-objects/curriculum-item-kind.vo';
import { canManageCurriculum, type CurriculumActor } from '../curriculum-actor';
// [Command ScanContradictions · Etapa 4]: compara los recursos de un idioma entre fuentes, marca CONTRADICCION_DETECTADA y la quita de lo ya resuelto | [Patrón]: Command Handler (CQRS) + Specification (dominio) | [Principio]: SRP + idempotencia (escanear dos veces deja el mismo resultado)

// [Resultado]: qué se revisó y qué conflictos hay (por tipo de recurso)
export interface ScanResult {
  language: Language;
  scanned: number; // Recursos comparados
  flagged: number; // Recursos que quedan con la bandera
  cleared: number; // Recursos a los que se les quitó (contradicción resuelta)
  contradictions: Array<Contradiction & { kind: CurriculumItemKind }>;
}

@Injectable()
export class ScanContradictionsCommand {
  constructor(
    @Inject(CURRICULUM_REPOSITORY)
    private readonly items: ICurriculumRepository,
  ) {}

  async execute(
    language: Language,
    kind: CurriculumItemKind | undefined,
    actor: CurriculumActor,
  ): Promise<ScanResult> {
    if (!canManageCurriculum(actor))
      throw new ForbiddenException(
        'Solo docentes y administradores revisan fuentes',
      );
    const kinds = kind ? [kind] : COMPARABLE_KINDS; // Sin tipo → todos los comparables
    const result: ScanResult = {
      language,
      scanned: 0,
      flagged: 0,
      cleared: 0,
      contradictions: [],
    };

    for (const k of kinds) {
      const items = await this.items.listForComparison(language, k);
      const found = findContradictions(k, items);
      const inConflict = new Set(
        found.flatMap((c) => c.items.map((i) => i.id)),
      ); // `flatMap` (ES2019)
      const wasFlagged = items
        .filter((i) => i.flags.includes(CONTRADICTION_FLAG))
        .map((i) => i.id);
      const off = wasFlagged.filter((id) => !inConflict.has(id)); // Ya no hay conflicto → se limpia la bandera
      await this.items.setFlag(CONTRADICTION_FLAG, [...inConflict], off);

      result.scanned += items.length;
      result.flagged += inConflict.size;
      result.cleared += off.length;
      result.contradictions.push(...found.map((c) => ({ ...c, kind: k })));
    }
    return result;
  }
}
