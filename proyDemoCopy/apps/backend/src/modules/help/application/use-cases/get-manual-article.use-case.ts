import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from '../../../users/domain/value-objects/role.vo';
import type { HelpLocale } from '../../domain/entities/faq.entity';
import { ManualArticle } from '../../domain/entities/manual-article.entity';
import { visibleRoles } from './list-manual.use-case';
import { manualDir } from './reindex-manual.use-case';
// [UseCase GetManualArticle · Sprint 7.10 · RF-95]: artículo del manual en Markdown (Angular lo convierte con marked y lo sanea con DOMPurify) | [Patrón]: Query | [Principio]: SRP + DRY (misma política de rol que la lista) + mínimo privilegio (lo no visible «no existe») | [Paradigma]: POO + async/await

@Injectable()
export class GetManualArticleUseCase {
  constructor(
    @InjectRepository(ManualArticle)
    private readonly articles: Repository<ManualArticle>,
  ) {}

  async execute(
    slug: string,
    locale: HelpLocale,
    viewer: Role,
  ): Promise<ManualArticle> {
    const article = await this.articles.findOneBy({
      slug,
      locale,
      role: In(visibleRoles(viewer)),
    });
    if (!article)
      throw new NotFoundException('Artículo del manual no encontrado');
    return article;
  }
}

// [GetManualAsset · Sprint 7.12]: capturas de pantalla del manual (docs/manual-usuario/capturas) servidas tal cual | [Patrón]: Query + Allowlist (nombre y extensión validados) | [Principio]: SSOT (las imágenes viven junto al Markdown; no se copian a otra app)
// [Seguridad]: solo `[a-z0-9-]+.(png|webp)` → sin rutas relativas (`..`) ni otros archivos del servidor · públicas (son capturas de la interfaz, sin datos personales)
const ASSET = /^([a-z0-9-]+)\.(png|webp)$/;

@Injectable()
export class GetManualAssetUseCase {
  async execute(file: string): Promise<{ bytes: Buffer; contentType: string }> {
    const m = ASSET.exec(file);
    if (!m) throw new NotFoundException('Imagen no encontrada');
    const bytes = await readFile(join(manualDir(), 'capturas', file)).catch(
      () => {
        throw new NotFoundException('Imagen no encontrada');
      },
    );
    return { bytes, contentType: `image/${m[2]}` };
  }
}
