import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Faq } from '../../domain/entities/faq.entity';
import type { ListFaqsQuery } from '../dtos/faq.dto';
// [UseCases ListFaqs + GetFaq · Sprint 7.10 · RF-94]: FAQ PÚBLICAS buscables y filtrables por categoría, rol e idioma | [Patrón]: Query (CQRS ligero) + Query Builder | [Principio]: SRP + mínimo privilegio (solo publicadas; las archivadas no salen) | [Paradigma]: POO + async/await
// ponytail: búsqueda ILIKE en pregunta y respuesta (decenas de FAQ); la búsqueda semántica la hace el Agente Guía con FAISS

@Injectable()
export class ListFaqsUseCase {
  constructor(@InjectRepository(Faq) private readonly faqs: Repository<Faq>) {}

  execute(q: ListFaqsQuery): Promise<Faq[]> {
    const qb = this.faqs
      .createQueryBuilder('f')
      .where("f.status = 'published'")
      .orderBy('f.category', 'ASC')
      .addOrderBy('f.question', 'ASC');
    if (q.locale) qb.andWhere('f.locale = :locale', { locale: q.locale });
    if (q.category)
      qb.andWhere('f.category = :category', { category: q.category });
    // [Rol]: las de ese rol + las de todos («ALL»)
    if (q.role) qb.andWhere("f.role IN (:role, 'ALL')", { role: q.role });
    if (q.q) {
      // `Brackets` (TypeORM): (pregunta OR respuesta) sin romper los AND anteriores · parámetro enlazado → sin inyección SQL
      const like = `%${q.q.replace(/[%_\\]/g, '\\$&')}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('f.question ILIKE :like', { like })
            .orWhere('f.answer ILIKE :like', { like }),
        ),
      );
    }
    return qb.getMany();
  }
}

@Injectable()
export class GetFaqUseCase {
  constructor(@InjectRepository(Faq) private readonly faqs: Repository<Faq>) {}

  async execute(id: string): Promise<Faq> {
    const faq = await this.faqs.findOneBy({ id, status: 'published' });
    if (!faq) throw new NotFoundException('Pregunta frecuente no encontrada');
    return faq;
  }
}
