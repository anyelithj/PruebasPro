// [Value Object Provenance]: procedencia del contenido — distingue lo verificado de lo generado | [Patrón]: Value Object + Provenance (trazabilidad) | [Principio]: SRP | [Paradigma]: Declarativo
// [Regla del producto]: nunca presentar contenido generado por IA como verificado

// `export enum` (TS): origen declarado del recurso
export enum Provenance {
  MANUAL = 'manual', // Escrito a mano por el autor
  IMPORTED = 'imported', // Importado de una fuente externa con licencia compatible (ver campo `source`)
  GENERATED = 'generated', // Generado por un LLM local; requiere revisión humana antes de aprobarse
  EXPERT_VALIDATED = 'expert_validated', // Validado por un especialista (solo ADMIN puede declararlo)
}

// [Etiquetas ES]: se muestran como insignia junto al contenido | [Patrón]: Lookup Table
export const PROVENANCE_LABEL_ES: Readonly<Record<Provenance, string>> =
  Object.freeze({
    [Provenance.MANUAL]: 'Manual',
    [Provenance.IMPORTED]: 'Importado',
    [Provenance.GENERATED]: 'Generado por IA',
    [Provenance.EXPERT_VALIDATED]: 'Validado por especialista',
  });
