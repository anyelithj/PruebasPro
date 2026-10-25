// [Value Object CourseNodeType]: niveles de la jerarquía Curso → Nivel → Módulo → Unidad → Lección (Etapa 3 de la especificación MCER) | [Patrón]: Composite (un tipo de nodo por nivel del árbol) + Value Object | [Principio]: SRP + OCP | [Paradigma]: Declarativo

// `export enum` (TS): el valor en minúsculas es el que guarda PostgreSQL (enum course_nodes_type_enum)
export enum CourseNodeType {
  LEVEL = 'level', // Nivel MCER del curso (A1…C2): raíz de cada rama
  MODULE = 'module', // Bloque temático dentro del nivel
  UNIT = 'unit', // Unidad dentro del módulo
  LESSON = 'lesson', // Lección: única hoja; enlaza recursos curriculares
}

// [Hijo permitido]: la regla de la jerarquía en una tabla inmutable → nunca una lección dentro de un nivel ni un módulo dentro de una lección | `null` = hoja
const CHILD: Readonly<Record<CourseNodeType, CourseNodeType | null>> =
  Object.freeze({
    [CourseNodeType.LEVEL]: CourseNodeType.MODULE,
    [CourseNodeType.MODULE]: CourseNodeType.UNIT,
    [CourseNodeType.UNIT]: CourseNodeType.LESSON,
    [CourseNodeType.LESSON]: null,
  });

// [childTypeOf]: tipo que debe tener el hijo de un nodo | función pura (fácil de testear)
export const childTypeOf = (type: CourseNodeType): CourseNodeType | null =>
  CHILD[type];
