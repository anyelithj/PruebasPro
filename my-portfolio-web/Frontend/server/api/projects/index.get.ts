// [MVC-C][PROXY] GET /api/projects — proxy al backend; si falla (stub 501), fallback estático.
import { defineEventHandler, getQuery } from 'h3';
import { useRuntimeConfig } from '#imports';
import { ok, resolveBackendBase } from '../../utils/response';

const FALLBACK = [
  {
    id: 'vue-notes-app',
    title: 'Web App con Vue & Supabase',
    description: 'Aplicación de notas colaborativas en tiempo real.',
    link: 'https://github.com/tu_usuario/vue-notes-app',
    techs: ['Vue', 'Supabase', 'TailwindCSS'],
  },
  {
    id: 'task-api',
    title: 'API con Node y Mongo',
    description: 'API REST para tareas, usuarios y autenticación.',
    link: 'https://github.com/tu_usuario/task-api',
    techs: ['Node.js', 'Express', 'MongoDB'],
  },
];

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const provider = (getQuery(event).provider as string) || (config.public.apiProvider as string);
  const base = resolveBackendBase(provider, {
    fastapiBaseUrl: config.fastapiBaseUrl as string,
    nestBaseUrl: config.nestBaseUrl as string,
  });

  try {
    const res = await $fetch<{ data?: unknown }>(`${base}/projects`, { timeout: 2500 });
    const data = (res as { data?: unknown }).data ?? res;
    return ok(data, `projects from ${provider}`);
  } catch {
    // backend project es stub (501) → servimos datos estáticos para no romper la UI.
    return ok(FALLBACK, 'projects fallback (backend stub)');
  }
});
