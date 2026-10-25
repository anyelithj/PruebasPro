// [OCP] extiende create sin modificarlo — todos los campos opcionales
import { z } from 'zod';
import { createPostSchema } from './create-post.dto';

export const updatePostSchema = createPostSchema.partial();

export type UpdatePostDto = z.infer<typeof updatePostSchema>;
