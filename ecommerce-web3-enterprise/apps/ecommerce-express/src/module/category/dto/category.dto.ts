// category.dto.ts => contratos de salida del módulo Category.

// CategoryDto => nodo plano (sin hijos)
export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  position: number;
  isActive: boolean;
  productCount: number;
}

// CategoryTreeDto => nodo del árbol (patrón Composite: un nodo contiene nodos del mismo tipo)
// "extends" + tipo recursivo => "children" es a su vez una lista de CategoryTreeDto
export interface CategoryTreeDto extends CategoryDto {
  children: CategoryTreeDto[];
}

// CategoryDetailDto => detalle con subcategorías directas y ruta de migas de pan (breadcrumb para SEO/UX)
export interface CategoryDetailDto extends CategoryTreeDto {
  breadcrumb: Array<Pick<CategoryDto, "id" | "name" | "slug">>;
}
