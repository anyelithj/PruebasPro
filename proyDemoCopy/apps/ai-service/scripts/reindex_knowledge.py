"""Comando «reindexar todo» del RAG del temario (Tarea 9 · RF-57): reconstruye el índice FAISS desde la BD.

Uso (desde apps/ai-service):  python -m scripts.reindex_knowledge [--include-drafts]
Mismo caso de uso que POST /assistant/knowledge/reindex (botón del panel) → un solo camino (DRY). Útil tras cambiar el
modelo de embeddings (SENTENCE_TRANSFORMER_MODEL) o restaurar la BD.

[Patrón]: Command (CLI) + Composition Root | [Principio]: SRP + DRY | [Paradigma]: asíncrono.
"""

import argparse  # stdlib: argumentos de línea de comandos
import asyncio
import json
import sys


async def main() -> int:
    from src.modules.assistant.application.use_cases.reindex_knowledge import ReindexKnowledgeUseCase
    from src.modules.assistant.infrastructure.repositories.knowledge_repository import SqlKnowledgeRepository
    from src.modules.feedback.infrastructure.clients.rag_retriever import get_rag_retriever
    from src.shared.config.database import async_session_factory

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--include-drafts", action="store_true", help="Incluir borradores (con menor confianza); por defecto, RAG_INCLUDE_DRAFTS")
    args = parser.parse_args()

    store = get_rag_retriever().store
    if store is None:
        print("Modelo de embeddings no disponible: revisa SENTENCE_TRANSFORMER_MODEL")
        return 1
    async with async_session_factory() as session:
        repo = SqlKnowledgeRepository(session, include_drafts=True if args.include_drafts else None)
        result = await ReindexKnowledgeUseCase(repo, store).execute()
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
