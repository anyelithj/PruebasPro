"""[FACADE] RAG — abstrae pgvector + LlamaIndex + embeddings Ollama.

Import perezoso de llama-index: la app arranca sin el paquete; solo el chat RAG
lo exige. Devuelve un query engine async listo para responder citando fuentes.
"""

from typing import Any

from src.config.settings import settings


class VectorStoreService:
    _index: Any = None  # cache de proceso — se construye una sola vez

    async def get_query_engine(self) -> Any:
        """Query engine sobre el índice pgvector (streaming, con fuentes)."""
        index = await self._get_index()
        return index.as_query_engine(streaming=False, similarity_top_k=4)

    async def _get_index(self) -> Any:
        if VectorStoreService._index is not None:
            return VectorStoreService._index

        from llama_index.core import Settings, VectorStoreIndex
        from llama_index.embeddings.ollama import OllamaEmbedding
        from llama_index.llms.ollama import Ollama
        from llama_index.vector_stores.postgres import PGVectorStore

        Settings.llm = Ollama(
            base_url=settings.ollama_base_url, model=settings.ollama_chat_model
        )
        Settings.embed_model = OllamaEmbedding(
            base_url=settings.ollama_base_url, model_name=settings.ollama_embed_model
        )

        vector_store = self._build_pg_store(PGVectorStore)
        VectorStoreService._index = VectorStoreIndex.from_vector_store(vector_store)
        return VectorStoreService._index

    def _build_pg_store(self, pg_vector_store_cls: Any) -> Any:
        """Construye PGVectorStore a partir del DATABASE_URL (async → sync DSN)."""
        # llama-index usa psycopg (sync) para el store; derivamos el DSN.
        dsn = settings.database_url.replace("+asyncpg", "")
        return pg_vector_store_cls.from_params(
            connection_string=dsn,
            table_name="portfolio_embeddings",
            embed_dim=768,  # nomic-embed-text
        )
