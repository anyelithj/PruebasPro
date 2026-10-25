// [DRY] Zod schema tipado — payload de creación de post
import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  excerpt: z.string().min(1).max(400),
  content: z.string().min(1),
  tags: z.array(z.string().min(1).max(60)).max(30).default([]),
  imageUrl: z.string().url().max(500).optional(),
  published: z.boolean().default(false),
});

export type CreatePostDto = z.infer<typeof createPostSchema>;
