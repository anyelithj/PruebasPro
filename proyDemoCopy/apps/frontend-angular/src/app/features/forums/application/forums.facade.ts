import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { AsyncState } from '@shared/utils/async-state';
import { ForumsRepository } from '../domain/forums.repository.port';
import type { LessonThreads, ThreadInput, ThreadPatch, ThreadPosts } from '../domain/models/forums';
// [ForumsFacade · Aplicación]: casos de uso «hilos de la lección», «hilo con respuestas», «crear», «responder», «editar», «moderar» y «retirar» | [Patrón]: Facade + State Machine (AsyncState) + Template Method (`act`) | [Principio]: SRP + DIP + DRY | [Paradigma]: Reactivo (signals) + async/await
// [UX]: después de cada escritura se relee la vista con el estado real del backend (contadores, fijado, cerrado)

@Injectable()
export class ForumsFacade {
  private readonly repo = inject(ForumsRepository);

  readonly lesson = new AsyncState<LessonThreads>();
  readonly thread = new AsyncState<ThreadPosts>();
  readonly busy = signal(false);
  readonly actionError = signal<string | null>(null);

  loadLesson(lessonId: string): Promise<LessonThreads | null> {
    return this.lesson.run(this.repo.threads(lessonId));
  }

  loadThread(id: string): Promise<ThreadPosts | null> {
    return this.thread.run(this.repo.posts(id));
  }

  createThread(lessonId: string, input: ThreadInput): Promise<boolean> {
    return this.act(this.repo.createThread(lessonId, input), () => this.loadLesson(lessonId));
  }

  reply(threadId: string, body: string): Promise<boolean> {
    return this.act(this.repo.createPost(threadId, body), () => this.loadThread(threadId));
  }

  editPost(threadId: string, postId: string, body: string): Promise<boolean> {
    return this.act(this.repo.updatePost(postId, body), () => this.loadThread(threadId));
  }

  removePost(threadId: string, postId: string): Promise<boolean> {
    return this.act(this.repo.removePost(postId), () => this.loadThread(threadId));
  }

  moderate(threadId: string, patch: ThreadPatch): Promise<boolean> {
    return this.act(this.repo.updateThread(threadId, patch), () => this.loadThread(threadId));
  }

  removeThread(threadId: string): Promise<boolean> {
    return this.act(this.repo.removeThread(threadId), async () => undefined);
  }

  // [act]: ocupado + error visible + relectura | [Patrón]: Template Method · [Principio]: DRY
  private async act(op: Observable<unknown>, reload: () => Promise<unknown>): Promise<boolean> {
    this.busy.set(true);
    this.actionError.set(null);
    try {
      await firstValueFrom(op);
      await reload();
      return true;
    } catch (err) {
      this.actionError.set(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
