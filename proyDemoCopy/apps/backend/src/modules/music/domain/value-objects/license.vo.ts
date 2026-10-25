// [Value Object License · Sprints 9.2/9.15 · RF-116/RF-128]: tipo de licencia, fuente y titular de los derechos de una canción o un diálogo | [Patrón]: Value Object + Specification (licenseProblem) | [Principio]: cumplimiento de derechos de autor + Fail Fast | [Paradigma]: Funcional
// [Regla del producto]: sin canciones con derechos reservados — solo dominio público, Creative Commons, obra propia o permiso escrito del titular; también lo usa Dialogues (DRY)

export const LICENSE_TYPES = [
  'public_domain', // Dominio público
  'creative_commons', // CC BY, CC BY-SA, CC0…
  'own_work', // Obra propia del docente o de la academia
  'permission', // Permiso escrito del titular
] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];

export interface License {
  type: LicenseType;
  source: string; // Dónde se obtuvo (URL o referencia bibliográfica)
  holder: string; // Titular de los derechos (autor, intérprete o «Aula de Idiomas»)
  variant?: string | null; // Creative Commons: «CC BY 4.0», «CC0 1.0»…
  confirmed: boolean; // El docente declara que tiene derecho a publicarlo
}

// [licenseProblem]: null = publicable · texto = qué falta (se muestra al docente y bloquea la publicación) | Función pura
export function licenseProblem(l: License | null | undefined): string | null {
  if (!l) return 'Falta declarar la licencia';
  if (!LICENSE_TYPES.includes(l.type)) return 'Tipo de licencia no admitido';
  if (!l.holder.trim()) return 'Indica el titular de los derechos';
  if (l.type !== 'own_work' && !l.source.trim())
    return 'Indica la fuente del material';
  if (l.type === 'creative_commons' && !l.variant?.trim())
    return 'Indica la variante de Creative Commons (por ejemplo, CC BY 4.0)';
  if (!l.confirmed) return 'Confirma que tienes derecho a publicarlo';
  return null;
}
