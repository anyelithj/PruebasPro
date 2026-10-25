import { z } from 'zod';
// [Modelo Forums · Dominio]: hilos y respuestas de una lección (contrato de /api/forums/* de NestJS) + reglas puras de permisos | [Patrón]: Schema-First (Zod) + Policy (funciones puras) | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional
// [Permisos]: espejo de los casos de uso de NestJS (UX) — el backend vuelve a comprobarlos siempre

export const ThreadSchema = z.object({
  id: z.string(),
  lessonId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  title: z.string(),
  body: z.string(),
  status: z.enum(['open', 'closed']),
  pinned: z.boolean(),
  postsCount: z.number().int(),
  lastPostAt: z.string(),
  createdAt: z.string(),
});
export type Thread = z.infer<typeof ThreadSchema>; // `z.infer` (Zod): tipo derivado del esquema (DRY)

export const PostSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  body: z.string(),
  editedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Post = z.infer<typeof PostSchema>;

export const LessonThreadsSchema = z.object({ lesson: z.object({ id: z.string(), courseId: z.string(), title: z.string() }), items: z.array(ThreadSchema) });
export type LessonThreads = z.infer<typeof LessonThreadsSchema>;
export const ThreadPostsSchema = z.object({ thread: ThreadSchema, items: z.array(PostSchema) });
export type ThreadPosts = z.infer<typeof ThreadPostsSchema>;

// [Entradas]: mismas reglas que los DTO de NestJS (class-validator) → el botón se habilita solo con datos válidos
export const ThreadInputSchema = z.object({ title: z.string().trim().min(5).max(160), body: z.string().trim().min(2).max(5000) });
export type ThreadInput = z.infer<typeof ThreadInputSchema>;
export const PostBodySchema = z.string().trim().min(1).max(5000);

export type ThreadPatch = Partial<Pick<Thread, 'title' | 'body' | 'pinned' | 'status'>>;
export type ForumRole = 'USER' | 'TEACHER' | 'ADMIN';
export interface Viewer {
  id: string;
  role: ForumRole | null;
}

// [Políticas]: moderan TEACHER/ADMIN · el autor edita lo suyo · autor o moderador retira | Puras
export const canModerate = (v: Viewer): boolean => v.role === 'TEACHER' || v.role === 'ADMIN';
export const canEdit = (v: Viewer, item: { authorId: string }): boolean => v.id === item.authorId;
export const canRemove = (v: Viewer, item: { authorId: string }): boolean => canEdit(v, item) || canModerate(v);
