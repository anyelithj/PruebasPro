// [REPOSITORY][SRP] queries Prisma de post — desacopla persistencia del negocio
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { PostModel } from '../model/post.model';

@Injectable()
export class PostRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Público: solo publicados, recientes primero.
  findPublished(): Promise<PostModel[]> {
    return this.prisma.post.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Admin: todos, recientes primero.
  findAll(): Promise<PostModel[]> {
    return this.prisma.post.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findById(id: string): Promise<PostModel | null> {
    return this.prisma.post.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<PostModel | null> {
    return this.prisma.post.findUnique({ where: { slug } });
  }

  create(data: Prisma.PostCreateInput): Promise<PostModel> {
    return this.prisma.post.create({ data });
  }

  update(id: string, data: Prisma.PostUpdateInput): Promise<PostModel> {
    return this.prisma.post.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.post.delete({ where: { id } });
  }
}
