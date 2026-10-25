// [SRP][OOP] lógica de proyectos — no toca HTTP, delega persistencia al repository
import { Injectable } from '@nestjs/common';
import { NotFoundException } from 'src/common/exceptions/not-found.exception';
import { slugify } from 'src/common/utils/slug.util';
import { CreateProjectDto } from '../dto/create-project.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { toProjectResponse, ProjectResponseDto } from '../dto/project-response.dto';
import { ProjectModel } from '../model/project.model';
import { ProjectRepository } from '../repository/project.repository';

@Injectable()
export class ProjectService {
  constructor(private readonly repository: ProjectRepository) {}

  async list(): Promise<ProjectResponseDto[]> {
    const projects = await this.repository.findAll();
    return projects.map(toProjectResponse);
  }

  async getById(id: string): Promise<ProjectResponseDto> {
    return toProjectResponse(await this.require(id));
  }

  async create(dto: CreateProjectDto): Promise<ProjectResponseDto> {
    const slug = await this.uniqueSlug(dto.title);
    const project = await this.repository.create({
      title: dto.title,
      slug,
      description: dto.description,
      link: dto.link,
      techs: dto.techs,
      featured: dto.featured,
      imageUrl: dto.imageUrl,
    });
    return toProjectResponse(project);
  }

  async update(id: string, dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    await this.require(id);
    // Si cambia el título, regenera slug único (excluyendo el propio proyecto).
    const slug = dto.title ? await this.uniqueSlug(dto.title, id) : undefined;
    const project = await this.repository.update(id, { ...dto, ...(slug ? { slug } : {}) });
    return toProjectResponse(project);
  }

  async delete(id: string): Promise<void> {
    await this.require(id);
    await this.repository.delete(id);
  }

  private async require(id: string): Promise<ProjectModel> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  // Garantiza slug URL-safe único; agrega sufijo -2, -3… si colisiona.
  private async uniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = slugify(title) || 'project';
    let candidate = base;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.repository.findBySlug(candidate);
      if (!existing || existing.id === excludeId) {
        return candidate;
      }
      n += 1;
      candidate = `${base}-${n}`;
    }
  }
}
