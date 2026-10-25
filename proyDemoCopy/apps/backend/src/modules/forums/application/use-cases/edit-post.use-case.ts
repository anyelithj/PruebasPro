import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ForumPost } from '../../domain/entities/forum-post.entity';
import { ForumThread } from '../../domain/entities/forum-thread.entity';
import { isModerator, type ForumActor } from './list-threads.use-case';
import { GetPostUseCase } from './list-posts.use-case';
// [UseCase EditPost · Sprint 7.14]: el autor edita su respuesta; autor o moderador la retiran | [Patrón]: Use Case (Command) + Soft Delete + Unit of Work (retirar + contador) | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + async/await

@Injectable()
export class EditPostUseCase {
  constructor(
    @InjectRepository(ForumPost) private readonly posts: Repository<ForumPost>,
    private readonly ds: DataSource,
    private readonly get: GetPostUseCase,
  ) {}

  async execute(
    id: string,
    actor: ForumActor,
    body: string,
  ): Promise<ForumPost> {
    const post = await this.get.execute(id, actor);
    if (post.authorId !== actor.id)
      throw new ForbiddenException('Solo el autor edita su respuesta'); // Moderar ≠ reescribir lo que dijo otro
    post.body = body;
    post.editedAt = new Date();
    return this.posts.save(post);
  }

  async remove(id: string, actor: ForumActor): Promise<{ removed: true }> {
    const post = await this.get.execute(id, actor);
    if (post.authorId !== actor.id && !isModerator(actor))
      throw new ForbiddenException('No puedes retirar esta respuesta');
    await this.ds.transaction(async (m) => {
      await m.softDelete(ForumPost, { id });
      await m.decrement(ForumThread, { id: post.threadId }, 'postsCount', 1);
    });
    return { removed: true };
  }
}
