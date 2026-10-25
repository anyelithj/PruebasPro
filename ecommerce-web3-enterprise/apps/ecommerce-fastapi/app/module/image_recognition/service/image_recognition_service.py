# image_recognition_service.py (TensorFlow + CLIP) => casos de uso: clasificar/indexar una imagen,
# buscar productos visualmente similares, consultar y borrar embeddings.
# Patrón: Service Layer + Strategy (ResNet-50 clasifica, CLIP embebe) + Facade (oculta preprocesado,
# modelos y pgvector detrás de 4 operaciones). Paradigma: POO (DIP) + asíncrono.
# Ahorro de recursos: la búsqueda NO guarda la imagen ni su vector (solo los usa en memoria) y la
# clasificación de un producto actualiza su fila en lugar de acumular vectores duplicados.

from typing import Any

import numpy as np

from app.module.image_recognition.exception.image_recognition_exception import (
    EmbeddingNotFoundError,
    InvalidImageError,
)
from app.module.image_recognition.ml import (
    clip_embedder,
    image_quality,
    resnet_classifier,
    visual_attributes,
)
from app.module.image_recognition.ml.image_preprocessor import (
    decode,
    preprocess,
    resize_center_crop,
)
from app.module.image_recognition.model.image_recognition_model import ImageEmbedding
from app.module.image_recognition.repository.image_recognition_repository import (
    ImageRecognitionRepository,
)
from app.shared.util.model_cache import run_model

VISION = "de visión (TensorFlow)"


# _pixels => bytes -> array listo para los modelos; errores de formato => 422
def _pixels(data: bytes) -> np.ndarray:
    try:
        return preprocess(data)
    except ValueError as error:
        raise InvalidImageError(str(error)) from error


class ImageRecognitionService:
    def __init__(self, repository: ImageRecognitionRepository) -> None:
        self.repository = repository

    # classify_image => etiquetas ResNet-50 + embedding CLIP; con product_id indexa el producto en
    # el feature store (alimenta la búsqueda visual y el arranque en frío de las predicciones)
    async def classify_image(
        self, data: bytes, filename: str, product_id: str | None
    ) -> ImageEmbedding:
        pixels = _pixels(data)
        labels = await run_model(resnet_classifier.classify, pixels, engine=VISION)
        embedding = await run_model(clip_embedder.embed, pixels, engine=VISION)
        entity = await self.repository.get_by_product(product_id) if product_id else None
        if entity is None:  # Primera vez: fila nueva con todos sus campos
            entity = await self.repository.add(
                ImageEmbedding(
                    product_id=product_id, filename=filename, labels=labels, embedding=embedding
                )
            )
        else:  # Re-clasificación del mismo producto: actualiza su fila (no duplica vectores)
            entity.filename, entity.labels, entity.embedding = filename, labels, embedding
        await self.repository.commit()
        await self.repository.refresh(entity)
        return entity

    # search => solo CLIP (ResNet no hace falta para comparar): la mitad de cómputo por búsqueda.
    # RF-06.4: con el MISMO embedding se reconocen colores, patrón, textura y logo (sin 2a pasada)
    async def search(
        self, data: bytes, k: int, brands: tuple[str, ...] = ()
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        pixels = _pixels(data)
        embedding = await run_model(clip_embedder.embed, pixels, engine=VISION)
        attributes = await run_model(
            visual_attributes.extract, pixels, embedding, brands, engine=VISION
        )
        return await self.repository.nearest(embedding, k), attributes

    # inspect => RF-06.6 calidad (resolución, nitidez, luz, contraste) + moderación de contenido de
    # una foto de producto ANTES de publicarla. No persiste nada (ni imagen ni vector)
    async def inspect(self, data: bytes) -> dict[str, Any]:
        try:
            image = decode(data)
        except ValueError as error:
            raise InvalidImageError(str(error)) from error
        embedding = await run_model(clip_embedder.embed, resize_center_crop(image), engine=VISION)
        moderation = await run_model(image_quality.moderate, embedding, engine=VISION)
        return {"quality": image_quality.assess_quality(image), "moderation": moderation}

    async def get_embedding(self, embedding_id: str) -> ImageEmbedding:
        entity = await self.repository.get(embedding_id)
        if entity is None:
            raise EmbeddingNotFoundError(embedding_id)
        return entity

    async def delete_embedding(self, embedding_id: str) -> None:
        await self.repository.delete(await self.get_embedding(embedding_id))
        await self.repository.commit()
