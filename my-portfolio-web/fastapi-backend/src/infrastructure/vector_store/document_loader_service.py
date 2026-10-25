"""[SRP] indexa proyectos / CV / blog en pgvector para el RAG.

Toma documentos (texto + metadata con la fuente) y los inserta en el índice.
Import perezoso de llama-index.
"""

from src.config.settings import settings


class DocumentLoaderService:
    async def index_documents(self, documents: list[dict[str, str]]) -> int:
        """Indexa una lista de {'text': ..., 'source': ...}. Devuelve el conteo.

        Cada documento conserva su 'source' en metadata para poder citarla en el RAG.
        """
        from llama_index.core import Document, Settings, StorageContext, VectorStoreIndex
        from llama_index.embeddings.ollama import OllamaEmbedding
        from llama_index.vector_stores.postgres import PGVectorStore

        Settings.embed_model = OllamaEmbedding(
            base_url=settings.ollama_base_url, model_name=settings.ollama_embed_model
        )
        dsn = settings.database_url.replace("+asyncpg", "")
        vector_store = PGVectorStore.from_params(
            connection_string=dsn,
            table_name="portfolio_embeddings",
            embed_dim=768,
        )
        storage = StorageContext.from_defaults(vector_store=vector_store)

        docs = [
            Document(text=d["text"], metadata={"source": d.get("source", "unknown")})
            for d in documents
        ]
        VectorStoreIndex.from_documents(docs, storage_context=storage)
        return len(docs)
