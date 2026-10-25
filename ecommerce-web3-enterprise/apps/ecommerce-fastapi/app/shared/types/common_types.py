# common_types.py (Pydantic v2) => tipos compartidos por todos los módulos (Value Objects).
# Patrón: VO + Generic DTO. Paradigma: tipado estático con genéricos.

from pydantic import BaseModel  # Clase base validada de Pydantic


# PageMeta => metadatos de paginación (mismo formato que buildPaginationMeta de Express)
class PageMeta(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int


# "class ApiResponse[T]" => genérico con sintaxis PEP 695 (Python 3.12+) para cualquier "data".
# Mismo sobre que Express (transform.interceptor.ts): { "success": true, "data": ..., "meta"? },
# así Next.js y Nuxt consumen FastAPI con el mismo cliente Axios y el mismo manejo de errores.
class ApiResponse[T](BaseModel):
    success: bool = True
    data: T
    meta: PageMeta | None = None  # Solo en listados paginados
