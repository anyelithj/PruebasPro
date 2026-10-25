// [FACADE] post bounded context — CRUD del blog (Nest + Prisma).
import { Module } from '@nestjs/common';
import { PostController } from './controller/post.controller';
import { PostRepository } from './repository/post.repository';
import { PostService } from './service/post.service';

@Module({
  controllers: [PostController],
  providers: [PostService, PostRepository],
  exports: [PostService, PostRepository],
})
export class PostModule {}
