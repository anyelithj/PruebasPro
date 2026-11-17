"""Corpus de idiomas del tutor: recursos curriculares de la base compartida (Sprint 5.3 → Tarea 9 · RF-57).

[Patrón]: Repository (solo lectura) + Mapper (recurso → fragmentos de texto con metadatos).
[Principio]: SRP + DRY (el conocimiento sale del mismo temario que ven los estudiantes; no hay un segundo corpus que mantener).
[Regla de la especificación]: por defecto solo contenido «revisado» → el tutor nunca presenta contenido de IA sin revisar como verificado;
RAG_INCLUDE_DRAFTS=true añade los borradores con la marca «borrador» (menor confianza en la búsqueda).
[Un solo flujo]: alta manual, importación por archivo y por enlace terminan en la misma tabla → este Mapper sirve a los tres orígenes.
"""

from collections.abc import Callable, Sequence
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.assistant.domain.interfaces.vector_store import ChunkStatus, KnowledgeDoc
from src.modules.assistant.domain.knowledge_text import chunk_words
from src.shared.config.settings import get_settings

# [Estados de la BD → estado del RAG]: lo que no aparece (archived) nunca se indexa | `dict` = Lookup Table
_STATUS: dict[str, ChunkStatus] = {
    "approved": "revisado",
    "reviewed": "revisado",
    "draft": "borrador",
    "generated": "borrador",
    "review_required": "borrador",
}

# `bindparam(..., expanding=True)` (SQLAlchemy): lista Python → `IN (...)` parametrizado (sin SQL dinámico)
_COLUMNS = (
    "SELECT id::text, language::text, level::text, kind::text, topic, content, review_status::text, COALESCE(source, ''), updated_at "
    "FROM curriculum_items WHERE review_status::text IN :statuses"
)
_SQL_ALL = text(_COLUMNS).bindparams(bindparam("statuses", expanding=True))
_SQL_IDS = text(f"{_COLUMNS} AND id::text IN :ids").bindparams(bindparam("statuses", expanding=True), bindparam("ids", expanding=True))


def _examples(c: dict[str, Any]) -> str:
    ex = [f"{e.get('text', '')} = {e.get('translationEs', '')}" for e in c.get("examples") or [] if isinstance(e, dict)]
    return f" Ejemplos: {'; '.join(ex[:3])}." if ex else ""


# [Texto por tipo]: Lookup Table de funciones (Strategy) | [Principio]: OCP (nuevo tipo = nueva entrada)
_TEXT: dict[str, Callable[[dict[str, Any]], str]] = {
    "vocabulary": lambda c: f"{c.get('lemma', '')}: significa «{c.get('translationEs', '')}»"
    + (f", {c['partOfSpeech']}" if c.get("partOfSpeech") else "")
    + (f", género {c['gender']}" if c.get("gender") else "")
    + "."
    + _examples(c),
    "grammar_rule": lambda c: f"Regla «{c.get('title', '')}»: {c.get('explanationEs', '')}"
    + (f" Estructura: {c['structure']}." if c.get("structure") else "")
    + _examples(c),
    "common_error": lambda c: f"Error frecuente: «{c.get('incorrect', '')}» → correcto: «{c.get('correct', '')}». {c.get('explanationEs', '')}",
    "example": lambda c: f"{c.get('text', '')} = {c.get('translationEs', '')}",
    "translation": lambda c: f"{c.get('source', '')} = {c.get('targetEs', '')}" + (f" ({c['notes']})" if c.get("notes") else ""),
    "pronunciation": lambda c: f"{c.get('text', '')} se pronuncia {(c.get('ipa') or {}).get('value', '')} ({(c.get('ipa') or {}).get('variant', '')}).",
}


def indexable_statuses(include_drafts: bool) -> list[str]:
    """Estados de la BD que entran al índice (función pura → se prueba sin BD)."""
    return [db for db, rag in _STATUS.items() if include_drafts or rag == "revisado"]


def to_docs(row: Sequence[Any]) -> list[KnowledgeDoc]:
    """Fila de `curriculum_items` → fragmentos (vacío si el tipo no es material explicativo). Función pura."""
    rid, language, level, kind, topic, content, status, origin, updated = row
    render = _TEXT.get(kind)
    if render is None or not isinstance(content, dict):
        return []  # Ejercicios y rúbricas no son conocimiento explicativo
    body = render(content).strip()
    if not body:
        return []
    # El encabezado con idioma, nivel y tema mejora la búsqueda («¿cómo saludo en francés A1?») y se repite en cada parte
    parts = chunk_words(f"[{language} {level} · {topic}]", body)
    return [
        KnowledgeDoc(
            id=rid if len(parts) == 1 else f"{rid}#{n}",
            language=language, level=level, kind=kind, topic=topic, text=part,
            resource_id=rid, status=_STATUS.get(status, "borrador"), origin=origin,
            updated=updated.isoformat() if hasattr(updated, "isoformat") else str(updated or ""),
        )  # fmt: skip
        for n, part in enumerate(parts, start=1)
    ]


class SqlKnowledgeRepository:
    def __init__(self, session: AsyncSession, include_drafts: bool | None = None) -> None:
        self._session = session
        # `None` → lo decide la variable de entorno RAG_INCLUDE_DRAFTS
        self._statuses = indexable_statuses(get_settings().rag_include_drafts if include_drafts is None else include_drafts)

    async def approved_docs(self) -> list[KnowledgeDoc]:
        """Todos los fragmentos indexables («Reindexar todo»)."""
        rows = (await self._session.execute(_SQL_ALL, {"statuses": self._statuses})).all()
        return [doc for row in rows for doc in to_docs(row)]  # Comprensión anidada = flat-map

    async def docs_for(self, resource_ids: Sequence[str]) -> list[KnowledgeDoc]:
        """Fragmentos indexables de esos recursos; un recurso borrado, archivado o en borrador (sin RAG_INCLUDE_DRAFTS) no devuelve nada."""
        if not resource_ids:
            return []
        rows = (await self._session.execute(_SQL_IDS, {"statuses": self._statuses, "ids": list(resource_ids)})).all()
        return [doc for row in rows for doc in to_docs(row)]
