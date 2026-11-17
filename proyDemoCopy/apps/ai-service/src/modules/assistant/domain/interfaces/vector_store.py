"""Puerto del almacén vectorial del tutor (base de conocimiento de idiomas).

[Patrón]: Port (Hexagonal) + Repository.
[Principio]: DIP — el retriever y los casos de uso no conocen FAISS.
[Paradigma]: POO estructural (`Protocol`).
[2026-11-13 · Tarea 9 · RF-57]: metadatos del fragmento (recurso, estado, fuente, fecha), alta/baja incremental por recurso
(sin fragmentos huérfanos) y búsqueda híbrida con filtros por nivel y tema.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Literal, Protocol

# `Literal` (typing): estados del fragmento que entiende el RAG (los de la BD se traducen en el repositorio)
ChunkStatus = Literal["revisado", "borrador"]


@dataclass(frozen=True)  # `frozen=True` (dataclasses): Value Object inmutable → seguro entre hilos
class KnowledgeDoc:
    """Fragmento de conocimiento recuperable (un concepto: regla + ejemplos juntos)."""

    id: str  # Id del fragmento («<recurso>#<n>» si un recurso largo se partió; el id del recurso si no)
    language: str  # en, fr, de, es, pt, zh, ru
    level: str  # A1…C2
    kind: str  # vocabulary, grammar_rule… (tipo del recurso curricular)
    topic: str
    text: str  # Texto que se codifica y se entrega como contexto
    source: str = ""  # [Sprint 7.9]: texto a mostrar o citar (respuesta de la FAQ, cuerpo de la sección del manual); vacío = `text`
    resource_id: str = ""  # [Tarea 9]: recurso del temario de origen (vacío = `id`) → editar/borrar el recurso reemplaza TODOS sus fragmentos
    status: ChunkStatus = "revisado"  # [Tarea 9]: «borrador» solo se indexa si RAG_INCLUDE_DRAFTS=true y puntúa con menor confianza
    origin: str = ""  # [Tarea 9]: fuente (URL o nombre de archivo) → el tutor la cita
    updated: str = ""  # [Tarea 9]: fecha ISO de la última edición del recurso
    owner: str = ""  # [2026-11-14 · RF-146]: "" = material público · id de usuario = SUS palabras «aprender» (solo las ve su dueño)

    @property  # `@property` (Python): atributo calculado de solo lectura
    def resource(self) -> str:
        """Recurso al que pertenece el fragmento (FAQ y manual: el propio id)."""
        return self.resource_id or self.id


class VectorStore(Protocol):
    """Contrato: reconstruir, mantener al día por recurso y buscar por significado."""

    def rebuild(self, docs: list[KnowledgeDoc]) -> int: ...  # Devuelve cuántos fragmentos quedaron indexados

    # [Tarea 9 · Sincronización]: reemplaza los fragmentos de `resource_ids` por `docs` (lista vacía = borrar) en una sola operación
    def replace_resources(self, resource_ids: Iterable[str], docs: list[KnowledgeDoc]) -> int: ...

    def search(self, query: str, top_k: int = 3, language: str | None = None) -> list[KnowledgeDoc]: ...

    # [Sprint 7.9]: igual que `search` pero con la similitud (0..1) → el Agente Guía decide con un umbral
    # [Tarea 9]: `level`/`theme` filtran por metadatos y `hybrid` suma la coincidencia de palabras clave (solo el RAG del temario)
    def search_scored(
        self,
        query: str,
        top_k: int = 3,
        language: str | None = None,
        min_score: float = 0.3,
        *,  # `*` (Python): lo que sigue solo por nombre → las llamadas antiguas posicionales no cambian
        level: str | None = None,
        theme: str | None = None,
        hybrid: bool = False,
        owner: str | None = None,  # [2026-11-14]: incluye además los fragmentos privados de este usuario (None = solo públicos)
    ) -> list[tuple[KnowledgeDoc, float]]: ...

    @property
    def size(self) -> int: ...
