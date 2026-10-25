import type { Observable } from 'rxjs';
import type { LessonThreads, Post, Thread, ThreadInput, ThreadPatch, ThreadPosts } from './models/forums';
// [Puerto ForumsRepository · Dominio]: hilos por lección, respuestas y moderación | [Patrón]: Port (Hexagonal) + Repository | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección a la vez

export abstract class ForumsRepository {
  abstract threads(lessonId: string): Observable<LessonThreads>;
  abstract createThread(lessonId: string, input: ThreadInput): Observable<Thread>;
  abstract updateThread(id: string, patch: ThreadPatch): Observable<Thread>;
  abstract removeThread(id: string): Observable<void>;
  abstract posts(threadId: string): Observable<ThreadPosts>;
  abstract createPost(threadId: string, body: string): Observable<Post>;
  abstract updatePost(id: string, body: string): Observable<Post>;
  abstract removePost(id: string): Observable<void>;
}
