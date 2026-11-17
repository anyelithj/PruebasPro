import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { assertUniqueTitle } from '../../../../shared/application/unique-title'; // [2026-10-28]: regla anti-duplicados compartida (DRY)
import { Dialogue } from '../../domain/entities/dialogue.entity';
import { type DialogueActor, DialogueAccess } from './get-dialogue.use-case';
// [UseCase UpdateDialogue · 2026-10-27]: «Editar» de Gestión → Actividades → Diálogos (Next.js) — título, nombres de los hablantes y nivel (los turnos se editan por /dialogue-turns)
// [Patrón]: Use Case (Command) + Guard reutilizable (DialogueAccess.editable: autor o ADMIN) | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + async/await

export interface DialoguePatch {
  title?: string;
  speakers?: string[];
  level?: string;
}

@Injectable()
export class UpdateDialogueUseCase {
  constructor(
    private readonly access: DialogueAccess,
    @InjectRepository(Dialogue)
    private readonly dialogues: Repository<Dialogue>,
  ) {}

  async execute(
    actor: DialogueActor,
    id: string,
    patch: DialoguePatch,
  ): Promise<Dialogue> {
    const d = await this.access.editable(actor, id);
    // [Fix 2026-10-28 · Sin duplicados]: renombrar a un título que ya usa otro diálogo vigente del mismo idioma → 409 (el propio `id` no cuenta)
    if (patch.title?.trim())
      await assertUniqueTitle(
        this.dialogues,
        patch.title.trim(),
        { language: d.language, withdrawnAt: IsNull() },
        { label: 'un diálogo', language: d.language },
        d.id,
      );
    // `...(cond ? {} : {})` (ES2018): solo se asignan los campos recibidos (PATCH parcial)
    Object.assign(d, {
      ...(patch.title?.trim() ? { title: patch.title.trim() } : {}),
      ...(patch.speakers?.length === 2
        ? { speakers: patch.speakers.map((s) => s.trim() || 'A') }
        : {}),
      ...(patch.level ? { level: patch.level } : {}),
    });
    return this.dialogues.save(d);
  }
}
