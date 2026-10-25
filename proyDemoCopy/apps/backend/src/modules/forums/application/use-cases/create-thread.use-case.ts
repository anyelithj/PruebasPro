import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForumThread } from '../../domain/entities/forum-thread.entity';
import { ForumAccess, type ForumActor } from './list-threads.use-case';
// [UseCase CreateThread · Sprint 7.14]: abrir un hilo en una lección (inscritos y docentes) | [Patrón]: Use Case (Command) | [Principio]: SRP + DRY (ForumAccess) | [Paradigma]: POO + async/await

export interface ThreadInput {
  title: string;
  body: string;
}

@Injectable()
export class CreateThreadUseCase {
  constructor(
    @InjectRepository(ForumThread)
    private readonly threads: Repository<ForumThread>,
    private readonly access: ForumAccess,
  ) {}

  async execute(
    lessonId: string,
    actor: ForumActor,
    input: ThreadInput,
  ): Promise<ForumThread> {
    const lesson = await this.access.lesson(lessonId, actor);
    return this.threads.save(
      this.threads.create({
        lessonId,
        courseId: lesson.courseId,
        authorId: actor.id,
        authorName: await this.access.authorName(actor.id),
        title: input.title,
        body: input.body,
        status: 'open',
        pinned: false,
        postsCount: 0,
        lastPostAt: new Date(),
      }),
    );
  }
}
