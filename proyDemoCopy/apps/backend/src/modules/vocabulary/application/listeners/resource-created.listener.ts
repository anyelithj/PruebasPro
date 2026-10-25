import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import jwtConfig from '../../../../shared/config/jwt.config';
import {
  CURRICULUM_REVIEWED_EVENT,
  type CurriculumReviewedEvent,
} from '../../../curriculum/domain/events/curriculum-reviewed.event';
import {
  CURRICULUM_REPOSITORY,
  type ICurriculumRepository,
} from '../../../curriculum/domain/interfaces/curriculum.repository.interface';
import { CurriculumItemKind } from '../../../curriculum/domain/value-objects/curriculum-item-kind.vo';
import { LookupTermUseCase } from '../use-cases/lookup-term.use-case';
// [Listener ResourceCreated · Sprint 8.2 · RF-108]: al publicarse un recurso de vocabulario se precalcula su traducción e IPA UK/US en la caché → el primer estudiante que lo abre no espera al LLM | [Patrón]: Observer (Domain Event) | [Principio]: OCP (Curriculum no conoce a Vocabulary) + DRY (LookupTerm) | [Paradigma]: Event-Driven
// [Token de servicio]: el evento no trae JWT → se firma uno de 2 min con el autor del recurso (mismo secreto que valida FastAPI); nunca sale del servidor

@Injectable()
export class ResourceCreatedListener {
  private readonly logger = new Logger(ResourceCreatedListener.name);

  constructor(
    @Inject(CURRICULUM_REPOSITORY)
    private readonly items: ICurriculumRepository,
    private readonly lookup: LookupTermUseCase,
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY) private readonly cfg: ConfigType<typeof jwtConfig>,
  ) {}

  // `{ async: true }`: no bloquea la aprobación del recurso | Errores solo al log (fire-and-forget)
  @OnEvent(CURRICULUM_REVIEWED_EVENT, { async: true })
  async handle(event: CurriculumReviewedEvent): Promise<void> {
    if (!event.approved) return;
    try {
      const item = await this.items.findById(event.itemId);
      if (!item || item.kind !== CurriculumItemKind.VOCABULARY) return;
      const raw = (item.content as { lemma?: unknown }).lemma;
      const lemma = typeof raw === 'string' ? raw.trim() : '';
      if (!lemma) return;
      const token = await this.jwt.signAsync(
        { sub: event.authorId, role: 'TEACHER', svc: 'vocabulary' },
        { secret: this.cfg.accessSecret, expiresIn: 120 },
      );
      await this.lookup.execute(
        { text: lemma, language: item.language },
        token,
      );
    } catch (err) {
      this.logger.warn(
        `Sin precálculo de IPA para ${event.itemId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
