"""Dependencies para inyectar modelos IA (carga perezosa + caché).

[Patrón]: Singleton (lru_cache) + Factory + Lazy Loading.
[Principio]: SRP + KISS — carga el modelo solo en primer uso.
[Paradigma]: Funcional.

[Sprint 5.1]: carga real de sentence-transformers y spaCy (antes eran placeholders que devolvían None).
"""
import logging
from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from src.shared.config.settings import Settings, get_settings

logger = logging.getLogger("ai-service.models")


@lru_cache(maxsize=1)
def _load_sentence_transformer():
    """Codificador de frases compartido (calificación por similitud y RAG del tutor).

    [Patrón]: Lazy Loading + Singleton — se carga una sola vez, en el primer uso.
    [Resiliencia]: si el modelo no se puede cargar (sin red ni caché), devuelve None y
    SimilarityModel usa difflib; el RAG usa búsqueda por palabras.
    """
    try:
        from sentence_transformers import SentenceTransformer  # Import perezoso: torch solo se carga si se usa

        name = get_settings().sentence_transformer_model
        try:
            # [Optimización]: primero la caché local (~/.cache/huggingface) sin red → evita ~40 consultas HEAD al Hub y unos segundos por arranque
            return SentenceTransformer(name, local_files_only=True)
        except OSError:  # Primera vez (sin caché): se descarga del Hub una sola vez
            return SentenceTransformer(name)
    except Exception as exc:  # noqa: BLE001 — cualquier fallo de carga activa el respaldo
        logger.warning("SentenceTransformer no disponible (%s): se usa el respaldo", exc)
        return None


@lru_cache(maxsize=1)
def _load_spacy_pipeline():
    """Pipeline spaCy para respuestas abiertas (similitud por vectores de palabras); None si falta el modelo."""
    try:
        import spacy

        return spacy.load(get_settings().spacy_model)
    except Exception as exc:  # noqa: BLE001
        logger.warning("spaCy no disponible (%s): NLPModel usa su respaldo", exc)
        return None


def get_sentence_transformer():
    """Dependency que devuelve el modelo cacheado."""
    return _load_sentence_transformer()


def get_spacy_pipeline():
    """Dependency que devuelve el pipeline cacheado."""
    return _load_spacy_pipeline()


# [Settings shortcut]: para endpoints que solo necesitan config
SettingsDep = Annotated[Settings, Depends(get_settings)]
