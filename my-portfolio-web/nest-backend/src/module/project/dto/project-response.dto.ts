// [SRP][ISP] shape de salida del proyecto
import { ProjectModel } from '../model/project.model';

export interface ProjectResponseDto {
  id: string;
  title: string;
  slug: string;
  description: string;
  link: string;
  techs: string[];
  featured: boolean;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toProjectResponse = (project: ProjectModel): ProjectResponseDto => ({
  id: project.id,
  title: project.title,
  slug: project.slug,
  description: project.description,
  link: project.link,
  techs: project.techs,
  featured: project.featured,
  imageUrl: project.imageUrl,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});
