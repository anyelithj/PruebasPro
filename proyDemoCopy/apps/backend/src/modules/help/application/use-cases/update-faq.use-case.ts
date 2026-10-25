import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faq } from '../../domain/entities/faq.entity';
import type { UpdateFaqDto } from '../dtos/faq.dto';
import { FaqIndexSync } from './create-faq.use-case';
// [UseCases UpdateFaq + ArchiveFaq · Sprint 7.10 · RF-97]: editar (renueva la fecha de revisión) o archivar (borrado lógico) una FAQ y reconstruir el índice del Agente Guía | [Patrón]: Use Case (Command) + State (published → archived) | [Principio]: SRP + DRY (FaqIndexSync compartido) | [Paradigma]: POO + async/await

@Injectable()
export class UpdateFaqUseCase {
  constructor(
    @InjectRepository(Faq) private readonly faqs: Repository<Faq>,
    private readonly sync: FaqIndexSync,
  ) {}

  async execute(id: string, dto: UpdateFaqDto, token: string): Promise<Faq> {
    const faq = await this.faqs.findOneBy({ id });
    if (!faq) throw new NotFoundException('Pregunta frecuente no encontrada');
    Object.assign(faq, dto, { reviewedAt: new Date() });
    const saved = await this.faqs.save(faq);
    await this.sync.execute(token);
    return saved;
  }
}

@Injectable()
export class ArchiveFaqUseCase {
  constructor(
    @InjectRepository(Faq) private readonly faqs: Repository<Faq>,
    private readonly sync: FaqIndexSync,
  ) {}

  // [Idempotente]: archivar dos veces no falla · el Agente Guía deja de citarla al reconstruir el índice
  async execute(id: string, token: string): Promise<{ archived: true }> {
    const { affected } = await this.faqs.update({ id }, { status: 'archived' });
    if (!affected)
      throw new NotFoundException('Pregunta frecuente no encontrada');
    await this.sync.execute(token);
    return { archived: true };
  }
}
