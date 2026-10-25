import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_URL } from '@core/http/api-url.token';
import { ForumsRepository } from '../domain/forums.repository.port';
import {
  LessonThreadsSchema,
  PostSchema,
  ThreadPostsSchema,
  ThreadSchema,
  type LessonThreads,
  type Post,
  type Thread,
  type ThreadInput,
  type ThreadPatch,
  type ThreadPosts,
} from '../domain/models/forums';
// [ForumsHttpRepository · Infraestructura]: HttpClient hacia /api/forums/* (BFF de Next.js → NestJS) | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP | [Paradigma]: Reactivo (RxJS)
// [Seguridad]: ids codificados en la URL · respuestas validadas con Zod

@Injectable()
export class ForumsHttpRepository extends ForumsRepository {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_URL)}/forums`;
  private readonly id = (v: string) => encodeURIComponent(v);

  threads(lessonId: string): Observable<LessonThreads> {
    return this.http.get<unknown>(`${this.base}/lessons/${this.id(lessonId)}/threads`).pipe(map((r) => LessonThreadsSchema.parse(r)));
  }

  createThread(lessonId: string, input: ThreadInput): Observable<Thread> {
    return this.http.post<unknown>(`${this.base}/lessons/${this.id(lessonId)}/threads`, input).pipe(map((r) => ThreadSchema.parse(r)));
  }

  updateThread(id: string, patch: ThreadPatch): Observable<Thread> {
    return this.http.patch<unknown>(`${this.base}/threads/${this.id(id)}`, patch).pipe(map((r) => ThreadSchema.parse(r)));
  }

  removeThread(id: string): Observable<void> {
    return this.http.delete(`${this.base}/threads/${this.id(id)}`).pipe(map(() => undefined));
  }

  posts(threadId: string): Observable<ThreadPosts> {
    return this.http.get<unknown>(`${this.base}/threads/${this.id(threadId)}/posts`).pipe(map((r) => ThreadPostsSchema.parse(r)));
  }

  createPost(threadId: string, body: string): Observable<Post> {
    return this.http.post<unknown>(`${this.base}/threads/${this.id(threadId)}/posts`, { body }).pipe(map((r) => PostSchema.parse(r)));
  }

  updatePost(id: string, body: string): Observable<Post> {
    return this.http.patch<unknown>(`${this.base}/posts/${this.id(id)}`, { body }).pipe(map((r) => PostSchema.parse(r)));
  }

  removePost(id: string): Observable<void> {
    return this.http.delete(`${this.base}/posts/${this.id(id)}`).pipe(map(() => undefined));
  }
}
