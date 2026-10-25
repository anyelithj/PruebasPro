"""Corpus de idiomas del tutor: recursos curriculares APROBADOS de la base compartida (Sprint 5.3).

[Patrón]: Repository (solo lectura) + Mapper (recurso → fragmento de texto).
[Principio]: SRP + DRY (el conocimiento sale del mismo currículo que ven los estudiantes; no hay un segundo corpus que mantener).
[Regla de la especificación]: solo contenido aprobado → el tutor nunca presenta contenido de IA sin revisar como verificado.
"""

from collections.abc import Callable
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc

_SQL = text(
    "SELECT id::text, language::text, level::text, kind::text, topic, content "
    "FROM curriculum_items WHERE review_status = 'approved'"
)


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


class SqlKnowledgeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def approved_docs(self) -> list[KnowledgeDoc]:
        rows = (await self._session.execute(_SQL)).all()
        docs = []
        for rid, language, level, kind, topic, content in rows:
            render = _TEXT.get(kind)
            if render is None or not isinstance(content, dict):
                continue  # Ejercicios y rúbricas no son conocimiento explicativo
            body = render(content).strip()
            if body:
                # El prefijo con idioma, nivel y tema mejora la búsqueda («¿cómo saludo en francés A1?»)
                docs.append(KnowledgeDoc(rid, language, level, kind, topic, f"[{language} {level} · {topic}] {body}"))
        return docs
