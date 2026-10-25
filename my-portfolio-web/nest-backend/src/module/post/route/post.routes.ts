// [DRY] constantes de rutas del blog
export const POST_ROUTES = {
  ROOT: 'posts',
  ADMIN: 'admin', // GET /posts/admin — lista completa (admin)
  BY_SLUG: 'slug/:slug', // GET /posts/slug/:slug — público
  BY_ID: ':id',
} as const;
