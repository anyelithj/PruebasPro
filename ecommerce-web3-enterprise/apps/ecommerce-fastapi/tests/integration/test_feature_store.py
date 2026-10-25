# test_feature_store.py (pytest + PostgreSQL/pgvector reales) => la búsqueda ANN coseno devuelve los
# productos en orden de similitud. Requiere la BD de docker-compose con "alembic upgrade head".

import asyncio

import numpy as np

from app.config.database_config import SessionFactory, engine
from app.module.image_recognition.model.image_recognition_model import ImageEmbedding
from app.shared.util.feature_store import nearest_products, product_embedding


def unit(vector: np.ndarray) -> list[float]:
    return (vector / np.linalg.norm(vector)).tolist()


def test_nearest_products_orders_by_cosine_similarity() -> None:
    rng = np.random.default_rng(1)
    base = rng.normal(size=512)
    rows = {
        "test-near": unit(base + rng.normal(scale=0.1, size=512)),
        "test-mid": unit(base + rng.normal(scale=1.0, size=512)),
        "test-far": unit(rng.normal(size=512)),
    }

    async def scenario() -> tuple[list[str], list[float] | None]:
        async with SessionFactory() as session:
            for pid, vector in rows.items():
                session.add(
                    ImageEmbedding(
                        product_id=pid, filename=f"{pid}.png", labels=[], embedding=vector
                    )
                )
            await session.commit()
            try:
                found = await nearest_products(session, unit(base), k=3)
                stored = await product_embedding(session, "test-near")
                return [row["product_id"] for row in found], stored
            finally:
                for entity in (await session.execute(ImageEmbedding.__table__.select())).all():
                    if entity.product_id in rows:
                        await session.execute(
                            ImageEmbedding.__table__.delete().where(ImageEmbedding.id == entity.id)
                        )
                await session.commit()
        await engine.dispose()

    order, stored = asyncio.run(scenario())
    assert order == ["test-near", "test-mid", "test-far"]
    assert stored is not None and len(stored) == 512
