// [Capa: Domain — entidad Project, agnóstica de framework.]
// [Paradigma: Tipado estructural. Sin lógica, solo forma.]

// [typescript: interface — contrato readonly de proyecto del portafolio.]
// [DDD: entidad con identidad (id) y atributos descriptivos.]
export interface Project {
  readonly id: string                  // [readonly id — invariante. Slug único, usable en URLs.]
  readonly title: string               // [Título mostrado por molecule ProjectCard.]
  readonly description: string         // [Resumen corto, a11y-friendly.]
  readonly link: string                // [URL del repo o demo.]
  readonly techs: readonly string[]    // [readonly array — protege contra mutación externa (inmutabilidad).]
  readonly imageUrl?: string | null    // [Portada opcional (Cloudinary).]
}
