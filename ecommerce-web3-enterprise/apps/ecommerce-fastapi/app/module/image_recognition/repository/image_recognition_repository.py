# image_recognition_repository.py (SQLAlchemy async + pgvector) => acceso a datos de ImageEmbedding.
# Patrón: Repository (hereda las operaciones comunes de SqlRepository: DRY) + Unit of Work.
# Paradigma: asíncrono + POO (herencia).

from typing import Any

from sqlalchemy import select

from app.config.database_config import SqlRepository
from app.module.image_recognition.ml import similarity_search
from app.module.image_recognition.model.image_recognition_model import ImageEmbedding


class ImageRecognitionRepository(SqlRepository[ImageEmbedding]):
    entity = ImageEmbedding

    async def get_by_product(self, product_id: str) -> ImageEmbedding | None:
        query = select(ImageEmbedding).where(ImageEmbedding.product_id == product_id)
        return (await self.session.execute(query)).scalar_one_or_none()

    async def nearest(self, embedding: list[float], k: int) -> list[dict[str, Any]]:
        return await similarity_search.search(self.session, embedding, k)
