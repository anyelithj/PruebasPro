import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ForumThread,
  type ThreadStatus,
} from '../../domain/entities/forum-thread.entity';
import {
  GetThreadUseCase,
  isModerator,
  type ForumActor,
} from './list-threads.use-case';
// [UseCase ModerateThread · Sprint 7.14]: el autor corrige su hilo; TEACHER/ADMIN lo fijan, cierran o retiran | [Patrón]: Use Case (Command) + State (open ↔ closed) + Soft Delete | [Principio]: SRP + mínimo privilegio (cada campo exige su permiso) | [Paradigma]: POO + async/await

export interface ThreadPatch {
  title?: string;
  body?: string;
  pinned?: boolean;
  status?: ThreadStatus;
}

@Injectable()
export class ModerateThreadUseCase {
  constructor(
    @InjectRepository(ForumThread)
    private readonly threads: Repository<ForumThread>,
    private readonly get: GetThreadUseCase,
  ) {}

  async execute(
    id: string,
    actor: ForumActor,
    patch: ThreadPatch,
  ): Promise<ForumThread> {
    const thread = await this.get.execute(id, actor);
    const mod = isModerator(actor);
    const own = thread.authorId === actor.id;
    // [Permisos]: texto = autor o moderador · fijar/cerrar = solo moderador
    if ((patch.title !== undefined || patch.body !== undefined) && !own && !mod)
      throw new ForbiddenException('Solo el autor edita su hilo');
    if ((patch.pinned !== undefined || patch.status !== undefined) && !mod)
      throw new ForbiddenException(
        'Solo un docente o administrador modera el foro',
      );
    Object.assign(thread, patch);
    return this.threads.save(thread);
  }

  // [remove]: borrado lógico (`softDelete`) → desaparece del foro, queda en la BD para auditoría
  async remove(id: string, actor: ForumActor): Promise<{ removed: true }> {
    const thread = await this.get.execute(id, actor);
    if (thread.authorId !== actor.id && !isModerator(actor))
      throw new ForbiddenException('No puedes retirar este hilo');
    await this.threads.softDelete({ id });
    return { removed: true };
  }
}
