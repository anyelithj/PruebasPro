"""Puerto del almacén vectorial del tutor (base de conocimiento de idiomas).

[Patrón]: Port (Hexagonal) + Repository.
[Principio]: DIP — el retriever y los casos de uso no conocen FAISS.
[Paradigma]: POO estructural (`Protocol`).
"""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class KnowledgeDoc:
    """Fragmento de conocimiento recuperable (sale de un recurso curricular APROBADO)."""

    id: str  # Id del recurso curricular (trazabilidad: de dónde salió la respuesta)
    language: str  # en, fr, de, es, pt, zh, ru
    level: str  # A1…C2
    kind: str  # vocabulary, grammar_rule…
    topic: str
    text: str  # Texto que se codifica y se entrega como contexto
    source: str = ""  # [Sprint 7.9]: texto a mostrar o citar (respuesta de la FAQ, cuerpo de la sección del manual); vacío = `text`


class VectorStore(Protocol):
    """Contrato: reconstruir el índice y buscar por significado."""

    def rebuild(self, docs: list[KnowledgeDoc]) -> int: ...  # Devuelve cuántos fragmentos quedaron indexados

    def search(self, query: str, top_k: int = 3, language: str | None = None) -> list[KnowledgeDoc]: ...

    # [Sprint 7.9]: igual que `search` pero con la similitud coseno (0..1) → el Agente Guía decide con un umbral
    def search_scored(
        self, query: str, top_k: int = 3, language: str | None = None, min_score: float = 0.3
    ) -> list[tuple[KnowledgeDoc, float]]: ...

    @property
    def size(self) -> int: ...
