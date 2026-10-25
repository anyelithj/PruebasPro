// [SRP][ISP] shape de salida del post
import { PostModel } from '../model/post.model';

export interface PostResponseDto {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  tags: string[];
  imageUrl: string | null;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const toPostResponse = (post: PostModel): PostResponseDto => ({
  id: post.id,
  title: post.title,
  slug: post.slug,
  excerpt: post.excerpt,
  content: post.content,
  tags: post.tags,
  imageUrl: post.imageUrl,
  published: post.published,
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
});
