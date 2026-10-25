"""Almacén vectorial FAISS para la base de conocimiento del tutor (Sprint 5.3).

[Patrón]: Adapter (implementa VectorStore) + Repository persistente (índice en disco).
[Principio]: DIP + SRP.
[Paradigma]: POO.
[Tecnología]: FAISS (IndexFlatIP sobre vectores normalizados = similitud coseno) + sentence-transformers multilingüe.
[Persistencia]: el índice y sus fragmentos se guardan en disco → al reiniciar no hay que recodificar todo.
"""

import json
import logging
import threading
from dataclasses import asdict
from pathlib import Path
from typing import Any

import faiss
import numpy as np

from src.modules.assistant.domain.interfaces.vector_store import KnowledgeDoc

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
        """Reemplaza el índice completo (los recursos aprobados cambian poco; reconstruir es simple y correcto)."""
        index = faiss.IndexFlatIP(self._encoder.get_sentence_embedding_dimension())
        if docs:
            index.add(self._encode([d.text for d in docs]))
        with self._lock:
            self._index, self._docs = index, list(docs)
            self._save()
        logger.info("Índice FAISS reconstruido: %d fragmentos", len(docs))
        return len(docs)

    def search(self, query: str, top_k: int = 3, language: str | None = None) -> list[KnowledgeDoc]:
        return [d for d, _ in self.search_scored(query, top_k, language)]

    def search_scored(
        self, query: str, top_k: int = 3, language: str | None = None, min_score: float = 0.3
    ) -> list[tuple[KnowledgeDoc, float]]:
        with self._lock:
            index, docs = self._index, self._docs
        if index is None or not docs:
            return []
        # Se piden más candidatos y luego se filtra por idioma (FAISS plano no filtra por metadatos)
        k = min(len(docs), top_k * 5 if language else top_k)
        scores, ids = index.search(self._encode([query]), k)
        # `min_score`: umbral mínimo de parecido (0.3 para el tutor; el Agente Guía usa uno más alto para responder sin LLM)
        hits = [(docs[i], float(s)) for i, s in zip(ids[0], scores[0], strict=True) if i >= 0 and s > min_score]
        if language:
            hits = [(d, s) for d, s in hits if d.language == language]
        return hits[:top_k]

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
