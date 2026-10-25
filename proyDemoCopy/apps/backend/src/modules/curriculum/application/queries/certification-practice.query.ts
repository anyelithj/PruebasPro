import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import {
  LANGUAGE_SKILL_LABEL_ES,
  type LanguageSkill,
} from '../../../../shared/domain/language-skill.vo';
import {
  findCertification,
  originalityGuidance,
  practiceTopic,
  type Certification,
} from '../../domain/certifications';
import type { CurriculumItemKind } from '../../domain/value-objects/curriculum-item-kind.vo';
import {
  GenerateContentDraftQuery,
  type DraftResult,
} from './ai-draft.queries';
// [Query CertificationPractice · Etapa 5]: borrador de ítems ORIGINALES de preparación para una certificación (no se guarda: el docente revisa y guarda) | [Patrón]: Query Handler (CQRS) + reutiliza el pipeline existente → caché → LLM | [Principio]: DRY + SRP

export interface CertificationPracticeInput {
  level: CefrLevel;
  skill: LanguageSkill;
  kind: CurriculumItemKind;
  count?: number;
}

// [Respuesta]: el borrador + el contexto de la certificación y el aviso que la UI muestra siempre
export interface CertificationPracticeResult extends DraftResult {
  certification: Pick<
    Certification,
    'id' | 'name' | 'issuer' | 'cefrMapping' | 'url'
  >;
  exam: string; // Examen del nivel (p. ej. «DELE B1»)
  topic: string; // Tema con el que se guardan los ítems
  notice: string; // Aviso de originalidad y de que no es un examen oficial
}

@Injectable()
export class CertificationPracticeQuery {
  constructor(private readonly drafts: GenerateContentDraftQuery) {}

  async execute(
    certificationId: string,
    input: CertificationPracticeInput,
    actorId: string,
  ): Promise<CertificationPracticeResult> {
    const cert = findCertification(certificationId);
    if (!cert)
      throw new NotFoundException(
        `Certificación «${certificationId}» no registrada`,
      );
    const level = cert.levels.find((l) => l.cefr === input.level);
    if (!level)
      throw new BadRequestException(
        `${cert.name} no tiene examen para el nivel ${input.level}`,
      );
    if (!cert.skills.includes(input.skill))
      throw new BadRequestException(
        `${cert.name} no evalúa la competencia «${LANGUAGE_SKILL_LABEL_ES[input.skill]}»`,
      );

    const topic = practiceTopic(
      level.exam,
      LANGUAGE_SKILL_LABEL_ES[input.skill],
    );
    const draft = await this.drafts.execute(
      {
        language: cert.language,
        level: input.level,
        skill: input.skill,
        kind: input.kind,
        topic,
        count: input.count,
        guidance: originalityGuidance(cert, level),
      },
      actorId,
    );
    const mapping =
      cert.cefrMapping === 'approximate'
        ? ' La correspondencia con el MCER es orientativa (no oficial).'
        : '';
    return {
      ...draft,
      certification: {
        id: cert.id,
        name: cert.name,
        issuer: cert.issuer,
        cefrMapping: cert.cefrMapping,
        url: cert.url,
      },
      exam: level.exam,
      topic,
      notice: `Ítems originales de preparación para ${level.exam}; no son preguntas oficiales ni sustituyen al examen de ${cert.issuer}.${mapping}`,
    };
  }
}
