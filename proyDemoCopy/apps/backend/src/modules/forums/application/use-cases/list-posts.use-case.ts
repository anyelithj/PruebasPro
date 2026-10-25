import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForumPost } from '../../domain/entities/forum-post.entity';
import type { ForumThread } from '../../domain/entities/forum-thread.entity';
import { GetThreadUseCase, type ForumActor } from './list-threads.use-case';
// [UseCases ListPosts + GetPost · Sprint 7.14]: respuestas de un hilo en orden cronológico (con el hilo, para pintar la página en una petición) | [Patrón]: Query (CQRS ligero) | [Principio]: SRP + DRY (acceso por GetThreadUseCase) | [Paradigma]: POO + async/await
// ponytail: hasta 500 respuestas por hilo sin paginar (hilos de una lección); paginar por cursor si un hilo crece más

@Injectable()
export class ListPostsUseCase {
  constructor(
    @InjectRepository(ForumPost) private readonly posts: Repository<ForumPost>,
    private readonly get: GetThreadUseCase,
  ) {}

  async execute(
    threadId: string,
    actor: ForumActor,
  ): Promise<{ thread: ForumThread; items: ForumPost[] }> {
    const thread = await this.get.execute(threadId, actor);
    const items = await this.posts.find({
      where: { threadId },
      order: { createdAt: 'ASC' },
      take: 500,
    });
    return { thread, items };
  }
}

@Injectable()
export class GetPostUseCase {
  constructor(
    @InjectRepository(ForumPost) private readonly posts: Repository<ForumPost>,
    private readonly get: GetThreadUseCase,
  ) {}

  async execute(id: string, actor: ForumActor): Promise<ForumPost> {
    const post = await this.posts.findOneBy({ id });
    if (!post) throw new NotFoundException('Respuesta no encontrada');
    await this.get.execute(post.threadId, actor); // Mismo acceso que su hilo
    return post;
  }
}
