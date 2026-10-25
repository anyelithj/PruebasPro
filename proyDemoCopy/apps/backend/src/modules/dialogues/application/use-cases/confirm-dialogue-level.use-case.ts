import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { licenseProblem } from '../../../music/domain/value-objects/license.vo';
import { Dialogue } from '../../domain/entities/dialogue.entity';
import { type DialogueActor, DialogueAccess } from './get-dialogue.use-case';
// [UseCase ConfirmDialogueLevel · Sprint 9.3 · RF-126/RF-128]: el docente confirma o cambia el nivel estimado; el diálogo queda «confirmado» y visible en la biblioteca (solo con licencia válida) | [Patrón]: State (estimated → confirmed) + Specification (licenseProblem) | [Principio]: verificación humana + mínimo privilegio | [Paradigma]: POO

@Injectable()
export class ConfirmDialogueLevelUseCase {
  constructor(
    private readonly access: DialogueAccess,
    @InjectRepository(Dialogue)
    private readonly dialogues: Repository<Dialogue>,
  ) {}

  async execute(
    actor: DialogueActor,
    id: string,
    level: string,
  ): Promise<Dialogue> {
    const d = await this.access.editable(actor, id);
    const problem = licenseProblem(d.license);
    if (problem) throw new BadRequestException(problem);
    Object.assign(d, { level, levelStatus: 'confirmed' });
    return this.dialogues.save(d);
  }

  // [setStatus · 2026-10-24]: publicar / despublicar desde Gestión → Actividades → Diálogos
  // «Publicado» = nivel confirmado (visible en la biblioteca) · «Borrador» = nivel estimado (solo lo ven su autor y el admin) | [Patrón]: State (levelStatus)
  async setStatus(actor: DialogueActor, id: string, status: 'published' | 'draft'): Promise<Dialogue> {
    if (status === 'published') {
      const d = await this.access.editable(actor, id);
      if (!d.level) throw new BadRequestException('Primero confirma el nivel del diálogo.');
      return this.execute(actor, id, d.level); // [DRY]: misma validación de licencia que confirmar el nivel
    }
    const d = await this.access.editable(actor, id);
    d.levelStatus = 'estimated';
    return this.dialogues.save(d);
  }
}
