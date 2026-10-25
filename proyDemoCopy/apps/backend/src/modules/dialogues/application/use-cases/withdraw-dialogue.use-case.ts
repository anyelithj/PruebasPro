import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import { Dialogue } from '../../domain/entities/dialogue.entity';
import {
  DIALOGUES_STORE,
  type DialogueActor,
  DialogueAccess,
} from './get-dialogue.use-case';
// [UseCase WithdrawDialogue · Sprint 9.3 · RF-128]: retira el diálogo (borrado lógico) y borra su audio | [Patrón]: Soft Delete | [Principio]: SRP + cumplimiento de derechos de autor | [Paradigma]: POO

@Injectable()
export class WithdrawDialogueUseCase {
  constructor(
    private readonly access: DialogueAccess,
    @InjectRepository(Dialogue)
    private readonly dialogues: Repository<Dialogue>,
    @Inject(DIALOGUES_STORE) private readonly store: ObjectStore,
  ) {}

  async execute(actor: DialogueActor, id: string): Promise<void> {
    const d = await this.access.editable(actor, id);
    if (d.audioKey) await this.store.remove(d.audioKey);
    Object.assign(d, { withdrawnAt: new Date(), audioKey: null });
    await this.dialogues.save(d);
  }
}
