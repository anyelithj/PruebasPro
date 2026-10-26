import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ReadingText } from '../../domain/entities/reading-text.entity';
// [ReadingAccess · Lectura · 2026-10-25]: carga un texto según el rol — el estudiante solo ve los publicados; el docente edita los suyos y el ADMIN todos | [Patrón]: Guard reutilizable (Specification) + Query | [Principio]: SRP + mínimo privilegio + DRY (lo usan todos los casos de uso) | [Paradigma]: POO
// [Archivo propio]: evita ciclos de importación entre casos de uso (SWC evalúa los metadatos de decoradores al cargar)

export interface ReadingActor {
  id: string;
  role: string;
}

@Injectable()
export class ReadingAccess {
  constructor(
    @InjectRepository(ReadingText)
    private readonly texts: Repository<ReadingText>,
  ) {}

  // [readable]: publicados para todos · borradores solo para quien puede editarlos (404 y no 403: no se revela que existe)
  async readable(actor: ReadingActor, id: string): Promise<ReadingText> {
    const t = await this.texts.findOneBy({ id, withdrawnAt: IsNull() });
    if (!t || (t.status !== 'published' && !this.canEdit(actor, t)))
      throw new NotFoundException('Lectura no encontrada');
    return t;
  }

  async editable(actor: ReadingActor, id: string): Promise<ReadingText> {
    const t = await this.texts.findOneBy({ id, withdrawnAt: IsNull() });
    if (!t) throw new NotFoundException('Lectura no encontrada');
    if (!this.canEdit(actor, t))
      throw new ForbiddenException('Solo el autor o un ADMIN puede editar esta lectura');
    return t;
  }

  canEdit(actor: ReadingActor, t: Pick<ReadingText, 'createdBy'>): boolean {
    return actor.role === 'ADMIN' || (actor.role === 'TEACHER' && t.createdBy === actor.id);
  }
}
