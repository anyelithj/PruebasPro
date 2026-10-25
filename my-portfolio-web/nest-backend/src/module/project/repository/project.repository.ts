// [REPOSITORY][SRP] queries Prisma de proyecto — desacopla persistencia del negocio
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { ProjectModel } from '../model/project.model';

@Injectable()
export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<ProjectModel[]> {
    return this.prisma.project.findMany({
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    });
  }

  findById(id: string): Promise<ProjectModel | null> {
    return this.prisma.project.findUnique({ where: { id } });
  }

  findBySlug(slug: string): Promise<ProjectModel | null> {
    return this.prisma.project.findUnique({ where: { slug } });
  }

  create(data: Prisma.ProjectCreateInput): Promise<ProjectModel> {
    return this.prisma.project.create({ data });
  }

  update(id: string, data: Prisma.ProjectUpdateInput): Promise<ProjectModel> {
    return this.prisma.project.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({ where: { id } });
  }
}
