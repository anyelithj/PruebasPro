import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PublishNotificationUseCase } from '../../../notifications/application/use-cases/publish-notification.use-case';
import { ForumPost } from '../../domain/entities/forum-post.entity';
import { ForumThread } from '../../domain/entities/forum-thread.entity';
import {
  ForumAccess,
  GetThreadUseCase,
  type ForumActor,
} from './list-threads.use-case';
// [UseCase CreatePost · Sprint 7.14]: responder a un hilo abierto y avisar al autor del hilo | [Patrón]: Use Case (Command) + Observer (aviso en la campana vía PublishNotificationUseCase) + Unit of Work (respuesta + contador en una transacción) | [Principio]: SRP + DRY (mismo canal de avisos que Payments y Reports) | [Paradigma]: POO + async/await

@Injectable()
export class CreatePostUseCase {
  private readonly logger = new Logger(CreatePostUseCase.name);

  constructor(
    @InjectRepository(ForumPost) private readonly posts: Repository<ForumPost>,
    private readonly ds: DataSource,
    private readonly get: GetThreadUseCase,
    private readonly access: ForumAccess,
    private readonly notify: PublishNotificationUseCase,
  ) {}

  async execute(
    threadId: string,
    actor: ForumActor,
    body: string,
  ): Promise<ForumPost> {
    const thread = await this.get.execute(threadId, actor);
    if (thread.status === 'closed')
      throw new ConflictException('El hilo está cerrado');
    const post = this.posts.create({
      threadId,
      authorId: actor.id,
      authorName: await this.access.authorName(actor.id),
      body,
      editedAt: null,
    });
    // `transaction` (TypeORM): la respuesta y el contador del hilo se guardan juntos o no se guarda nada
    const saved = await this.ds.transaction(async (m) => {
      const p = await m.save(post);
      await m.increment(ForumThread, { id: threadId }, 'postsCount', 1);
      await m.update(
        ForumThread,
        { id: threadId },
        { lastPostAt: p.createdAt },
      );
      return p;
    });
    if (thread.authorId !== actor.id) {
      // [Fail-soft]: un aviso perdido no anula la respuesta ya guardada
      await this.notify
        .execute({
          userId: thread.authorId,
          title: `Nueva respuesta en «${thread.title}»`,
          body: `${post.authorName}: ${body.slice(0, 140)}`,
          href: `/foros/hilo/${threadId}`,
        })
        .catch((err: unknown) =>
          this.logger.warn(
            `Aviso de foro no enviado: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }
    return saved;
  }
}
