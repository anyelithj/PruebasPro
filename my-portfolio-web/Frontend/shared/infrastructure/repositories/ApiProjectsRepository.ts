// [REPOSITORY][OCP] adapter que implementa IProjectsApiRepository contra el BFF Nitro.
// El BFF (/api/projects) ya proxya al backend elegido y hace fallback si es stub.
import type { IProjectsApiRepository } from '../../domain/ports/IProjectsApiRepository';
import type { Project } from '../../domain/entities/Project';
import { projectListSchema } from '../../schemas/project.schema';

export function createApiProjectsRepository(
  fetcher: typeof $fetch = $fetch,
): IProjectsApiRepository {
  return {
    async getAll(): Promise<readonly Project[]> {
      const res = await fetcher<{ data?: unknown }>('/api/projects');
      const raw = (res as { data?: unknown }).data ?? res;
      // Valida/normaliza con el schema compartido antes de entregar al dominio.
      return projectListSchema.parse(raw) as readonly Project[];
    },
  };
}
