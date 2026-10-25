# image_recognition_model.py (SQLAlchemy 2.0 + pgvector) => entidad ImageEmbedding: etiquetas
# ResNet-50 y embedding CLIP de una imagen. Es el feature store visual (shared/util/feature_store.py
# lo consulta). Patrón: Active Record/Entity. Paradigma: POO + tipado estático (Mapped[...]).

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.config.database_config import Base
from app.shared.constants.ml_constants import EMBEDDING_DIM
from app.shared.util.feature_store import Vector


class ImageEmbedding(Base):
    __tablename__ = "image_embeddings"  # Tabla ml.image_embeddings
    # Índice HNSW (pgvector) con distancia coseno: búsqueda aproximada en milisegundos sin recorrer
    # la tabla completa (menos CPU por consulta a medida que crece el catálogo)
    __table_args__ = (
        Index(
            "ix_image_embeddings_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # "unique=True" => una sola fila por producto (re-clasificar actualiza, no duplica vectores);
    # NULL permitido varias veces: imágenes clasificadas que no son de un producto
    product_id: Mapped[str | None] = mapped_column(String(36), unique=True)
    filename: Mapped[str] = mapped_column(String(255))
    labels: Mapped[list] = mapped_column(JSON)  # [{"label": "running_shoe", "score": 0.91}, ...]
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
