// [DDD] entidad de post del dominio — re-exporta el tipo Prisma
import { Post } from '@prisma/client';

export type PostModel = Post;
