"""ReindexManualUseCase — divide los artículos del manual por sección (`## `) y reconstruye su índice FAISS (Sprint 7.9 · RF-95/97).

[Patrón]: Command + Use Case + Mapper (artículo Markdown → secciones citables).
[Principio]: SRP + DIP + SSOT (el Markdown vive en docs/manual-usuario; NestJS lo lee y lo envía aquí).
[Paradigma]: POO + Funcional (`split_sections` es pura).
"""

import asyncio
import re
import unicodedata

from pydantic import BaseModel, ConfigDict, Field

from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc, VectorStore

_HEADING = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)  # Solo segundo nivel: «# Título» es el del artículo


class ManualArticleIn(BaseModel):
    """Artículo del manual tal como lo manda NestJS Help. [Patrón]: DTO."""

    model_config = ConfigDict(frozen=True, extra="ignore")
    slug: str = Field(..., pattern=r"^[a-z0-9-]+$")
    title: str
    role: str = "ALL"  # ALL | USER | TEACHER | ADMIN
    locale: str = "es"
    body: str = Field(..., max_length=200_000)  # Markdown completo


def anchor(title: str) -> str:
    """«Cómo pagar» → «como-pagar» (mismo ancla que pinta Angular en el artículo). [Paradigma]: función pura."""
    # NFD + ASCII: quita tildes de cualquier idioma (á, ñ, ç…) igual que `normalize('NFD')` en Angular (models/help.ts · anchor)
    plain = unicodedata.normalize("NFD", title).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", plain).strip("-")


def split_sections(article: ManualArticleIn) -> list[KnowledgeDoc]:
    """Una sección por encabezado `## `; el texto antes del primero es la introducción del artículo."""
    parts = _HEADING.split(article.body)  # [intro, título1, cuerpo1, título2, cuerpo2…]
    pairs = [(article.title, parts[0])] + list(zip(parts[1::2], parts[2::2], strict=True))
    docs = []
    for title, body in pairs:
        text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", body).strip()  # Las capturas no aportan texto al índice
        if text:
            sid = f"{article.slug}#{anchor(title)}" if title != article.title else article.slug
            docs.append(KnowledgeDoc(sid, article.locale, article.role, article.slug, title, f"{article.title} · {title}: {text}", text))
    return docs


class ReindexManualUseCase:
    def __init__(self, store: VectorStore) -> None:
        self._store = store

    async def execute(self, articles: list[ManualArticleIn]) -> dict[str, object]:
        docs = [d for a in articles for d in split_sections(a)]
        indexed = await asyncio.to_thread(self._store.rebuild, docs)
        return {"articles": len(articles), "sections": indexed}
