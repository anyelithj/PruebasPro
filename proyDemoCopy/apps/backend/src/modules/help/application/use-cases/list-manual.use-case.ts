import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from '../../../users/domain/value-objects/role.vo';
import type { HelpLocale, HelpRole } from '../../domain/entities/faq.entity';
import { ManualArticle } from '../../domain/entities/manual-article.entity';
// [UseCase ListManual · Sprint 7.10 · RF-95]: tabla de contenido del manual por rol (artículos + sus secciones `## `) | [Patrón]: Query (CQRS ligero) + Policy (`visibleRoles`) | [Principio]: SRP + mínimo privilegio (cada rol ve lo suyo y lo de todos; ADMIN ve todo) | [Paradigma]: POO + Funcional

// [visibleRoles]: misma regla que el Agente Guía de FastAPI (faq_retriever.visible_to) → la UI y el agente nunca discrepan
export const visibleRoles = (role: Role): HelpRole[] =>
  role === Role.ADMIN ? ['ALL', 'USER', 'TEACHER', 'ADMIN'] : ['ALL', role];

// [headings]: secciones del artículo (las que cita el Agente Guía) | [Paradigma]: función pura
export const headings = (body: string): string[] =>
  [...body.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]);

export interface ManualEntry {
  slug: string;
  title: string;
  role: HelpRole;
  locale: HelpLocale;
  sections: string[];
  updatedAt: Date;
}

@Injectable()
export class ListManualUseCase {
  constructor(
    @InjectRepository(ManualArticle)
    private readonly articles: Repository<ManualArticle>,
  ) {}

  // `only` (?role=): el ADMIN puede revisar el manual de otro rol; para el resto se ignora fuera de lo visible
  async execute(
    viewer: Role,
    locale: HelpLocale,
    only?: HelpRole,
  ): Promise<ManualEntry[]> {
    const allowed = visibleRoles(viewer).filter(
      (r) => !only || r === only || r === 'ALL',
    );
    const rows = await this.articles.find({
      where: { locale, role: In(allowed) },
      order: { role: 'ASC', title: 'ASC' },
    });
    return rows.map(({ slug, title, role, locale: l, body, updatedAt }) => ({
      slug,
      title,
      role,
      locale: l,
      sections: headings(body),
      updatedAt,
    }));
  }
}
