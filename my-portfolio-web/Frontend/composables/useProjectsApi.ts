// [REPOSITORY-PROXY] provee proyectos al UI desde la API (BFF), con fallback al repo estático.
// [OCP] no toca useProjects (sync/estático); es una variante que consume backend en vivo.
import { useAsyncData } from '#app';
import { createApiProjectsRepository } from '~/shared/infrastructure/repositories/ApiProjectsRepository';
import { createStaticProjectsRepository } from '~/shared/infrastructure/repositories/StaticProjectsRepository';
import type { Project } from '~/shared/domain/entities/Project';

export function useProjectsApi() {
  const repo = createApiProjectsRepository();

  const { data, pending, error, refresh } = useAsyncData<readonly Project[]>(
    'projects-api',
    async () => {
      try {
        return await repo.getAll();
      } catch {
        // último recurso: repo estático del dominio (nunca dejamos la UI vacía).
        return createStaticProjectsRepository().getAll();
      }
    },
    { default: () => [] as readonly Project[] },
  );

  return { projects: data, pending, error, refresh };
}
