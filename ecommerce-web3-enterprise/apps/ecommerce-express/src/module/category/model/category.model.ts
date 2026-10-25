// category.model.ts => lógica de árbol de categorías como funciones PURAS (patrón Composite).
// El árbol se construye en memoria a partir de la lista plana en O(n) con un Map (una sola consulta a la DB,
// en vez de N consultas recursivas).
import type { CategoryDto, CategoryTreeDto } from "../dto/category.dto";

// buildCategoryTree => lista plana -> bosque de árboles ordenado por "position"
export function buildCategoryTree(categories: CategoryDto[]): CategoryTreeDto[] {
  // "new Map(...)" => índice id -> nodo; cada nodo arranca con children vacío
  const nodes = new Map<string, CategoryTreeDto>(categories.map((category) => [category.id, { ...category, children: [] }]));
  const roots: CategoryTreeDto[] = [];

  for (const node of nodes.values()) {
    // Si el padre existe (y está en la lista), el nodo cuelga de él; si no, es raíz
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  // Ordena recursivamente cada nivel (función anidada: recursión sobre el Composite)
  const sortLevel = (level: CategoryTreeDto[]): CategoryTreeDto[] => {
    level.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, "es"));
    level.forEach((child) => sortLevel(child.children));
    return level;
  };
  return sortLevel(roots);
}

// collectDescendantIds => IDs de toda la rama (el nodo + sus descendientes): usado para filtrar productos
// de "Ropa" incluyendo "Camisetas", y para detectar ciclos al mover categorías
export function collectDescendantIds(categories: Pick<CategoryDto, "id" | "parentId">[], rootId: string): Set<string> {
  // Índice padre -> hijos para recorrer en anchura (BFS) sin recursión profunda
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    childrenByParent.set(category.parentId, [...(childrenByParent.get(category.parentId) ?? []), category.id]);
  }

  const result = new Set<string>([rootId]);
  const queue = [rootId]; // Cola FIFO del recorrido BFS
  while (queue.length > 0) {
    const current = queue.shift() as string; // "as string" => la cola no está vacía (verificado en el while)
    for (const childId of childrenByParent.get(current) ?? []) {
      if (!result.has(childId)) {
        result.add(childId);
        queue.push(childId);
      }
    }
  }
  return result;
}

// buildBreadcrumb => ruta raíz -> categoría actual (para migas de pan y JSON-LD BreadcrumbList)
export function buildBreadcrumb<T extends Pick<CategoryDto, "id" | "parentId">>(categories: T[], id: string): T[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const path: T[] = [];
  let current = byId.get(id);
  // Límite de profundidad defensivo: un ciclo accidental en datos no produce un bucle infinito
  while (current && path.length < 20) {
    path.unshift(current); // "unshift" => inserta al inicio: se construye de la hoja hacia la raíz
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}
