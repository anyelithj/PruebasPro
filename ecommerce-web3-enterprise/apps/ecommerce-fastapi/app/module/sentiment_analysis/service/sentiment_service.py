# sentiment_service.py (embeddings multilingües) => casos de uso: analizar, consultar, agregar y
# limpiar la caché de análisis de sentimiento.
# Patrón: Service Layer + Strategy (codificador configurable) + Cache-Aside (el texto ya analizado
# se devuelve sin volver a ejecutar el modelo). Paradigma: POO (DIP) + asíncrono.

from datetime import UTC, datetime, timedelta

from app.config.llm_config import get_llm_settings
from app.module.sentiment_analysis.exception.sentiment_exception import SentimentNotFoundError
from app.module.sentiment_analysis.ml.bert_sentiment import sentiment_classifier
from app.module.sentiment_analysis.ml.sentiment_aggregator import aggregate
from app.module.sentiment_analysis.model.sentiment_model import SentimentResult
from app.module.sentiment_analysis.repository.sentiment_repository import SentimentRepository
from app.shared.decorator.cache_decorator import content_hash, redis_cached
from app.shared.util.model_cache import run_model

PERIODS = {"7d": 7, "30d": 30, "90d": 90}  # Periodos válidos de GET /aggregate


def _engine() -> str:
    settings = get_llm_settings()
    return "bert_base_multi" if settings.TEXT_ENCODER == "bert" else settings.OLLAMA_EMBED_MODEL


class SentimentService:
    def __init__(self, repository: SentimentRepository) -> None:
        self.repository = repository

    async def analyze(
        self, text: str, product_id: str | None, review_id: str | None
    ) -> SentimentResult:
        text_hash = content_hash(text)
        if (cached := await self.repository.by_hash(text_hash)) is not None:  # Caché: 0 cómputo
            return cached
        label, score = await run_model(
            sentiment_classifier().classify, text, engine="de lenguaje (Ollama)"
        )
        result = SentimentResult(
            text_hash=text_hash,
            text=text,
            product_id=product_id,
            review_id=review_id,
            label=label,
            score=score,
            engine=_engine(),
        )
        await self.repository.add(result)
        await self.repository.commit()
        await self.repository.refresh(result)
        return result

    async def get(self, result_id: str) -> SentimentResult:
        if (result := await self.repository.get(result_id)) is None:
            raise SentimentNotFoundError(result_id)
        return result

    # aggregate => caché Redis 5 min: el panel puede refrescarse seguido sin repetir la consulta
    @redis_cached("sentiment:aggregate", ttl=300)
    async def aggregate(self, *, product_id: str | None, period: str) -> dict:
        since = datetime.now(UTC) - timedelta(days=PERIODS[period])
        metrics = aggregate(await self.repository.scores_since(since, product_id))
        # "**" => desempaqueta el dict
        return {"product_id": product_id, "period": period, **metrics}

    async def clear_cache(self) -> int:
        deleted = await self.repository.delete_all()
        await self.repository.commit()
        return deleted
