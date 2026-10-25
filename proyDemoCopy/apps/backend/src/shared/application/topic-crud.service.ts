import { ConflictException, NotFoundException } from '@nestjs/common';
import { IsNull, type FindOptionsWhere, type Repository } from 'typeorm';
// [TopicCrudService<T> · Sprint 9.3]: crear, listar, ver, editar y archivar temas sobre la entidad de cada módulo — lo usa Dialogues y lo reutilizarán Grammar y Polyglot (Fase 10) | [Patrón]: Generic Service (Template de CRUD) + Soft Delete | [Principio]: DRY + OCP (un módulo nuevo solo aporta su entidad) | [Paradigma]: POO genérica (TypeScript generics)

// [TopicLike]: lo mínimo que comparte cualquier tema (el resto de columnas lo define cada módulo)
export interface TopicLike {
  id: string;
  slug: string;
  title: string;
  language: string | null; // null = tema para todos los idiomas
  levels: string[]; // Vacío = todos los niveles
  createdBy: string | null; // null = tema semilla del sistema
  archivedAt: Date | null;
}

// [slugify]: «Comida y bebida» → «comida-y-bebida» (sin tildes ni signos) | Función pura
export const slugify = (title: string): string =>
  title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

export class TopicCrudService<T extends TopicLike> {
  // `protected readonly` (TS): el repositorio de la entidad concreta lo inyecta cada módulo (useFactory)
  constructor(
    protected readonly repo: Repository<T>,
    private readonly label = 'Tema',
  ) {}

  async create(
    actorId: string,
    input: Partial<T> & { title: string },
  ): Promise<T> {
    const slug = slugify(input.title);
    if (await this.repo.existsBy({ slug } as FindOptionsWhere<T>))
      throw new ConflictException(
        `Ya existe un ${this.label.toLowerCase()} con ese nombre`,
      );
    return this.repo.save(
      this.repo.create({
        ...input,
        slug,
        createdBy: actorId,
        archivedAt: null,
      } as T),
    );
  }

  // [list]: activos del idioma (o de todos) y del nivel; el filtro de niveles es en memoria (los temas son pocos)
  async list(f: { language?: string; level?: string }): Promise<T[]> {
    const all = await this.repo.find({
      where: { archivedAt: IsNull() } as FindOptionsWhere<T>,
      order: { title: 'ASC' } as never,
    });
    return all.filter(
      (t) =>
        (!f.language || t.language === null || t.language === f.language) &&
        (!f.level || !t.levels.length || t.levels.includes(f.level)),
    );
  }

  async get(id: string): Promise<T> {
    const t = await this.repo.findOneBy({
      id,
      archivedAt: IsNull(),
    } as FindOptionsWhere<T>);
    if (!t) throw new NotFoundException(`${this.label} no encontrado`);
    return t;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const t = await this.get(id);
    const FIXED = new Set(['id', 'slug', 'createdBy']); // El slug no cambia: las sesiones y diálogos guardan el id
    Object.assign(
      t,
      Object.fromEntries(
        Object.entries(patch).filter(
          ([k, v]) => v !== undefined && !FIXED.has(k),
        ),
      ),
    );
    return this.repo.save(t);
  }

  async archive(id: string): Promise<void> {
    const t = await this.get(id);
    t.archivedAt = new Date();
    await this.repo.save(t);
  }
}
