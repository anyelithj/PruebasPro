"""Almacén vectorial FAISS para la base de conocimiento del tutor (Sprint 5.3).

[Patrón]: Adapter (implementa VectorStore) + Repository persistente (índice en disco).
[Principio]: DIP + SRP.
[Paradigma]: POO.
[Tecnología]: FAISS (IndexFlatIP sobre vectores normalizados = similitud coseno) + sentence-transformers multilingüe.
[Persistencia]: el índice y sus fragmentos se guardan en disco → al reiniciar no hay que recodificar todo.
[2026-11-13 · Tarea 9 · RF-57]: alta/baja incremental por recurso (reusa los vectores ya calculados: solo codifica lo nuevo),
búsqueda híbrida (vectores + palabras clave) y filtros por idioma, nivel y tema.
"""

import json
import logging
import threading
from collections.abc import Iterable
from dataclasses import asdict
from pathlib import Path
from typing import Any

import faiss
import numpy as np

from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc
from src.modules.assistant.domain.knowledge_text import keyword_score, theme_of

# [Búsqueda híbrida]: peso de cada señal y castigo de los borradores (menor confianza) | constantes de módulo = SSOT
_VECTOR_WEIGHT, _KEYWORD_WEIGHT = 0.7, 0.3
_DRAFT_FACTOR = 0.85

logger = logging.getLogger("ai-service.rag")


class FaissStore:
    def __init__(self, encoder: Any, directory: Path) -> None:
        self._encoder = encoder  # SentenceTransformer compartido (el mismo que usa la calificación por similitud)
        self._dir = directory
        self._lock = threading.Lock()  # [Concurrencia]: reconstruir y buscar no se pisan entre hilos
        self._index: faiss.Index | None = None
        self._docs: list[KnowledgeDoc] = []
        self._load()

    @property
    def size(self) -> int:
        return len(self._docs)

    def _encode(self, texts: list[str]) -> np.ndarray:
        # `normalize_embeddings=True`: producto interno = coseno → IndexFlatIP da similitud directa
        return np.asarray(self._encoder.encode(texts, normalize_embeddings=True, batch_size=32), dtype="float32")

    def rebuild(self, docs: list[KnowledgeDoc]) -> int:
        """Reemplaza el índice completo («Reindexar todo»: comando y botón del panel).

        [2026-11-14]: las palabras privadas de los usuarios (`owner`) no vienen del temario → se conservan.
        """
        with self._lock:
            private = [d for d in self._docs if d.owner]
        docs = list(docs) + private
        index = self._new_index()
        if docs:
            index.add(self._encode([d.text for d in docs]))
        with self._lock:
            self._index, self._docs = index, list(docs)
            self._save()
        logger.info("Índice FAISS reconstruido: %d fragmentos", len(docs))
        return len(docs)

    def replace_resources(self, resource_ids: Iterable[str], docs: list[KnowledgeDoc]) -> int:
        """Quita TODOS los fragmentos de esos recursos y añade `docs` (editar = reemplazar; borrar = `docs` vacío).

        Los vectores que se conservan se copian del índice (`reconstruct_n`) → solo se codifica lo nuevo.
        [ponytail]: copia O(n) del índice plano por cambio; basta para miles de recursos. Con cientos de miles → IndexIDMap2 + remove_ids.
        """
        drop = set(resource_ids) | {d.resource for d in docs}  # `set` (stdlib): pertenencia O(1)
        fresh = self._encode([d.text for d in docs]) if docs else None  # Codifica FUERA del candado: las búsquedas no esperan al modelo
        with self._lock:
            keep = [i for i, d in enumerate(self._docs) if d.resource not in drop]
            index = self._new_index()
            if keep and self._index is not None:
                index.add(self._index.reconstruct_n(0, self._index.ntotal)[keep])  # Indexado por lista (NumPy): solo las filas conservadas
            if fresh is not None:
                index.add(fresh)
            removed = len(self._docs) - len(keep)
            self._index, self._docs = index, [self._docs[i] for i in keep] + list(docs)
            self._save()
        logger.info("Índice FAISS: -%d / +%d fragmentos (recursos %s)", removed, len(docs), sorted(drop)[:5])
        return len(docs)

    def search(self, query: str, top_k: int = 3, language: str | None = None) -> list[KnowledgeDoc]:
        return [d for d, _ in self.search_scored(query, top_k, language)]

    def search_scored(
        self,
        query: str,
        top_k: int = 3,
        language: str | None = None,
        min_score: float = 0.3,
        *,
        level: str | None = None,
        theme: str | None = None,
        hybrid: bool = False,
        owner: str | None = None,
    ) -> list[tuple[KnowledgeDoc, float]]:
        with self._lock:
            index, docs = self._index, self._docs
        if index is None or not docs:
            return []
        # [Candidatos]: con filtros o híbrida se puntúan TODOS (FAISS plano no filtra por metadatos y una coincidencia por palabra clave
        # puede tener poco parecido vectorial); si no, como antes (más candidatos solo si se filtra por idioma)
        full = hybrid or level is not None or theme is not None
        k = len(docs) if full else min(len(docs), top_k * 5 if language else top_k)
        scores, ids = index.search(self._encode([query]), k)
        hits: list[tuple[KnowledgeDoc, float]] = []
        for i, cosine in zip(ids[0], scores[0], strict=True):
            if i < 0:
                continue  # FAISS rellena con -1 cuando hay menos resultados que `k`
            d = docs[i]
            if d.owner and d.owner != owner:
                continue  # [Privacidad]: las palabras de un usuario nunca llegan al contexto de otro
            if (language and d.language != language) or (level and d.level != level) or (theme and theme_of(d.kind) != theme):
                continue
            score = float(cosine)
            if hybrid:
                score = (_VECTOR_WEIGHT * score + _KEYWORD_WEIGHT * keyword_score(query, d.text)) * (_DRAFT_FACTOR if d.status == "borrador" else 1.0)
            if score > min_score:  # `min_score`: umbral mínimo de parecido (0.3 tutor; el Agente Guía usa uno más alto)
                hits.append((d, score))
        hits.sort(key=lambda h: h[1], reverse=True)  # La híbrida reordena; `sort` es estable
        return hits[:top_k]

    def _new_index(self) -> faiss.Index:
        """Índice plano de producto interno (= coseno con vectores normalizados): exacto, sin entrenamiento."""
        return faiss.IndexFlatIP(self._encoder.get_sentence_embedding_dimension())

    # ───── Persistencia en disco ─────
    def _save(self) -> None:
        self._dir.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self._index, str(self._dir / "knowledge.faiss"))
        (self._dir / "knowledge.json").write_text(json.dumps([asdict(d) for d in self._docs], ensure_ascii=False), encoding="utf-8")

    def _load(self) -> None:
        idx, meta = self._dir / "knowledge.faiss", self._dir / "knowledge.json"
        if idx.exists() and meta.exists():
            try:
                self._index = faiss.read_index(str(idx))
                self._docs = [KnowledgeDoc(**d) for d in json.loads(meta.read_text(encoding="utf-8"))]
                logger.info("Índice FAISS cargado de disco: %d fragmentos", len(self._docs))
            except Exception as exc:  # noqa: BLE001 — índice corrupto → se reconstruye en el próximo arranque
                logger.warning("No se pudo leer el índice FAISS (%s); se reconstruirá", exc)
                self._index, self._docs = None, []
