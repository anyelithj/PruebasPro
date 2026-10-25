import type { CefrLevel } from '../../../shared/domain/cefr-level.vo';
import type { LanguageSkill } from '../../../shared/domain/language-skill.vo';
import { CourseNodeType } from './value-objects/course-node-type.vo';
import type { CurriculumItemKind } from './value-objects/curriculum-item-kind.vo';
import type { ReviewStatus } from './value-objects/review-status.vo';
// [Esquema del curso]: convierte el árbol anidado (lo que envía el autor) en filas planas y vuelve a armarlo para leerlo | [Patrón]: Composite + Builder | [Principio]: SRP (sin BD ni HTTP) + KISS | [Paradigma]: Funcional (funciones puras)

// ───── Entrada: esquema anidado Curso → Nivel → Módulo → Unidad → Lección ─────
export interface OutlineLesson {
  id?: string; // [Identidad estable]: nodo existente → se actualiza (el progreso de los estudiantes no se pierde)
  title: string;
  topic: string; // Tema curricular que la lección necesita (clave para reutilizar recursos)
  kind: CurriculumItemKind; // Tipo de recurso (vocabulario, regla gramatical…)
  skill: LanguageSkill; // Competencia (la necesita la IA si hay que generar)
}
export interface OutlineUnit {
  id?: string;
  title: string;
  lessons: OutlineLesson[];
}
export interface OutlineModule {
  id?: string;
  title: string;
  units: OutlineUnit[];
}
export interface OutlineLevel {
  id?: string;
  level: CefrLevel;
  title?: string; // Opcional: por defecto «Nivel A1»
  modules: OutlineModule[];
}

// [Fila planeada]: `ref` identifica el nodo antes de tener id de BD ("0.1.2" = nivel 0, módulo 1, unidad 2) → permite enlazar padre e hijo al insertar
export interface PlannedNode {
  ref: string;
  id: string | null; // Id existente (actualizar) o null (crear)
  parentRef: string | null;
  type: CourseNodeType;
  title: string;
  position: number;
  level: CefrLevel;
  topic: string | null;
  kind: CurriculumItemKind | null;
  skill: LanguageSkill | null;
}

// [flattenOutline]: recorrido en profundidad (padre antes que hijos) → el repositorio inserta en este orden | `flatMap` (ES2019)
export function flattenOutline(
  levels: ReadonlyArray<OutlineLevel>,
): PlannedNode[] {
  const node = (
    id: string | undefined,
    ref: string,
    parentRef: string | null,
    type: CourseNodeType,
    title: string,
    position: number,
    level: CefrLevel,
    lesson?: OutlineLesson,
  ): PlannedNode => ({
    id: id ?? null,
    ref,
    parentRef,
    type,
    title: title.trim(),
    position,
    level,
    topic: lesson?.topic.trim() ?? null, // `?.` + `??` (ES2020): solo las lecciones tienen tema
    kind: lesson?.kind ?? null,
    skill: lesson?.skill ?? null,
  });
  return levels.flatMap((lv, l) => [
    node(
      lv.id,
      `${l}`,
      null,
      CourseNodeType.LEVEL,
      lv.title?.trim() || `Nivel ${lv.level}`,
      l,
      lv.level,
    ),
    ...lv.modules.flatMap((m, mi) => [
      node(m.id, `${l}.${mi}`, `${l}`, CourseNodeType.MODULE, m.title, mi, lv.level),
      ...m.units.flatMap((u, ui) => [
        node(
          u.id,
          `${l}.${mi}.${ui}`,
          `${l}.${mi}`,
          CourseNodeType.UNIT,
          u.title,
          ui,
          lv.level,
        ),
        ...u.lessons.map((ls, li) =>
          node(
            ls.id,
            `${l}.${mi}.${ui}.${li}`,
            `${l}.${mi}.${ui}`,
            CourseNodeType.LESSON,
            ls.title,
            li,
            lv.level,
            ls,
          ),
        ),
      ]),
    ]),
  ]);
}

// ───── Salida: árbol para leer, con huecos marcados ─────
export interface LessonItemView {
  id: string;
  key: string;
  kind: CurriculumItemKind;
  reviewStatus: ReviewStatus;
}
export interface OutlineNodeView {
  id: string;
  type: CourseNodeType;
  title: string;
  level: CefrLevel;
  topic: string | null;
  kind: CurriculumItemKind | null;
  skill: LanguageSkill | null;
  items?: LessonItemView[]; // Solo lecciones
  gap?: boolean; // Solo lecciones: true = sin recursos → hueco que se puede generar
  completed?: boolean; // Solo lecciones: el usuario actual ya la completó
  children: OutlineNodeView[];
}
// [Fila leída]: lo mínimo que el árbol necesita de la entidad (ISP: no depende de TypeORM)
export interface StoredNode {
  id: string;
  parentId: string | null;
  type: CourseNodeType;
  title: string;
  position: number;
  level: CefrLevel;
  topic: string | null;
  kind: CurriculumItemKind | null;
  skill: LanguageSkill | null;
  items?: ReadonlyArray<LessonItemView>;
}

// [buildTree]: filas planas → árbol ordenado por posición | `Map` (ES2015): hijos por padre en O(n)
export function buildTree(nodes: ReadonlyArray<StoredNode>): OutlineNodeView[] {
  const byParent = new Map<string | null, StoredNode[]>();
  for (const n of nodes)
    byParent.set(n.parentId, [...(byParent.get(n.parentId) ?? []), n]);
  const build = (parentId: string | null): OutlineNodeView[] =>
    [...(byParent.get(parentId) ?? [])]
      .sort((a, b) => a.position - b.position) // `sort` con comparador numérico
      .map((n) => {
        const isLesson = n.type === CourseNodeType.LESSON;
        const items = isLesson ? [...(n.items ?? [])] : undefined;
        return {
          id: n.id,
          type: n.type,
          title: n.title,
          level: n.level,
          topic: n.topic,
          kind: n.kind,
          skill: n.skill,
          ...(isLesson ? { items, gap: items!.length === 0 } : {}), // Spread condicional (ES2018)
          children: build(n.id),
        };
      });
  return build(null);
}

// ───── Progreso y línea de tiempo ─────

// [lessonsInOrder]: lecciones en el orden del curso (recorrido en profundidad) → la «siguiente» es la primera sin completar | recursión + `flatMap` (ES2019)
export const lessonsInOrder = (tree: ReadonlyArray<OutlineNodeView>): OutlineNodeView[] =>
  tree.flatMap((n) => (n.type === CourseNodeType.LESSON ? [n] : lessonsInOrder(n.children)));

// [withProgress]: marca las lecciones completadas por el usuario | función pura (devuelve un árbol nuevo, no muta)
export const withProgress = (tree: ReadonlyArray<OutlineNodeView>, done: ReadonlySet<string>): OutlineNodeView[] =>
  tree.map((n) => ({
    ...n,
    ...(n.type === CourseNodeType.LESSON ? { completed: done.has(n.id) } : {}),
    children: withProgress(n.children, done),
  }));

// [nextLessonId]: primera lección sin completar (null = curso terminado o sin lecciones)
export const nextLessonId = (tree: ReadonlyArray<OutlineNodeView>): string | null =>
  lessonsInOrder(tree).find((l) => !l.completed)?.id ?? null;

// [summarize]: resumen para el autor → cuántas lecciones hay y cuántas siguen vacías | recursión sobre el árbol
export function summarize(tree: ReadonlyArray<OutlineNodeView>): {
  lessons: number;
  gaps: number;
  completed: number;
} {
  const lessons = lessonsInOrder(tree); // [DRY]: mismo recorrido que la línea de tiempo
  return {
    lessons: lessons.length,
    gaps: lessons.filter((l) => l.gap).length,
    completed: lessons.filter((l) => l.completed).length,
  };
}
