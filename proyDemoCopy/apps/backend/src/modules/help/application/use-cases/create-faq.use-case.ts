import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssistantClientService } from '../../../ai/assistant-client.service';
import { Faq } from '../../domain/entities/faq.entity';
import type { CreateFaqDto } from '../dtos/faq.dto';
// [UseCases CreateFaq + FaqIndexSync · Sprint 7.10 · RF-97]: el ADMIN crea una FAQ y el índice del Agente Guía se reconstruye con TODAS las publicadas | [Patrón]: Use Case (Command) + Write-Through (BD → índice FAISS de FastAPI) | [Principio]: SRP + SSOT (la tabla manda) + DRY (crear, editar, archivar y reindexar usan el mismo FaqIndexSync) | [Paradigma]: POO + async/await
// [Fail-soft]: si FastAPI no responde la FAQ se guarda igual (aparece en /ayuda/faq); el índice se pone al día en la próxima edición o con «Reindexar manual»

@Injectable()
export class FaqIndexSync {
  private readonly logger = new Logger(FaqIndexSync.name);

  constructor(
    @InjectRepository(Faq) private readonly faqs: Repository<Faq>,
    private readonly assistant: AssistantClientService,
  ) {}

  // [execute]: true = índice al día · el token es el del ADMIN que hizo el cambio (FastAPI exige rol ADMIN)
  async execute(token: string): Promise<boolean> {
    const published = await this.faqs.find({ where: { status: 'published' } });
    const payload = published.map((f) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
      category: f.category,
      role: f.role,
      locale: f.locale,
      manual_slug: f.manualSlug, // snake_case: contrato Pydantic de FastAPI (FaqIn)
    }));
    return this.assistant
      .embedFaqs(payload, token)
      .then(() => true)
      .catch((err: unknown) => {
        this.logger.warn(
          `Índice de FAQ sin actualizar: ${err instanceof Error ? err.message : String(err)}`,
        );
        return false;
      });
  }
}

@Injectable()
export class CreateFaqUseCase {
  constructor(
    @InjectRepository(Faq) private readonly faqs: Repository<Faq>,
    private readonly sync: FaqIndexSync,
  ) {}

  async execute(dto: CreateFaqDto, token: string): Promise<Faq> {
    const faq = await this.faqs.save(
      this.faqs.create({
        ...dto,
        manualSlug: dto.manualSlug ?? null,
        status: 'published',
        reviewedAt: new Date(),
      }),
    );
    await this.sync.execute(token);
    return faq;
  }
}
