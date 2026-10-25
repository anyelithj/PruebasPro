# personalization_service.py (TruncatedSVD + FAISS + CLIP) => casos de uso: recomendaciones por
# usuario (con caché), registrar/borrar interacciones y reentrenar el modelo en segundo plano.
# Patrón: Service Layer + Strategy (híbrido CF/contenido/popular) + Cache-Aside (perfil válido 1 h
# o hasta que haya un modelo nuevo) + Producer (Celery). Paradigma: POO (DIP) + asíncrono.

import asyncio
from datetime import UTC, datetime, timedelta

import joblib

from app.config.app_config import get_settings
from app.config.celery_config import celery_app
from app.module.ml_prediction.ml.model_loader import load_model
from app.module.personalization.exception.personalization_exception import InteractionNotFoundError
from app.module.personalization.ml import collaborative_filter, content_based_filter
from app.module.personalization.ml.collaborative_filter import EVENT_WEIGHTS
from app.module.personalization.ml.hybrid_recommender import blend, hit_rate
from app.module.personalization.model.personalization_model import (
    InteractionRecord,
    PersonalizationModel,
    PersonalizationProfile,
)
from app.module.personalization.repository.personalization_repository import (
    PersonalizationRepository,
)
from app.shared.middleware.auth_middleware import AuthUser, ensure_owner
from app.shared.types.ml_types import JobStatus

TRAIN_TASK = "personalization.train_model"
PROFILE_TTL = timedelta(hours=1)
TOP_K = 10


class PersonalizationService:
    def __init__(self, repository: PersonalizationRepository) -> None:
        self.repository = repository

    async def recommendations(self, user: AuthUser, user_id: str) -> PersonalizationProfile:
        ensure_owner(user, user_id)
        model_row = await self.repository.latest_model()
        profile = await self.repository.profile(user_id)
        fresh = profile and datetime.now(UTC) - profile.updated_at < PROFILE_TTL
        if profile and fresh and profile.model_version_id == (model_row.id if model_row else None):
            return profile  # Caché vigente: 0 cómputo

        signals = await self.repository.signals(user_id)
        seen = signals.sort_values("created_at")["product_id"].tolist()
        model = (
            load_model(model_row.artifact_path) if model_row and model_row.artifact_path else None
        )
        cf = collaborative_filter.recommend(model, user_id, TOP_K * 2) if model else {}
        cbf = await content_based_filter.recommend(self.repository.session, seen, TOP_K * 2)
        items = blend(cf, cbf, model.popular if model else [], len(seen), TOP_K)

        if profile is None:
            profile = PersonalizationProfile(user_id=user_id, recommendations=items)
            await self.repository.save(profile)
        profile.recommendations, profile.model_version_id = (
            items,
            model_row.id if model_row else None,
        )
        profile.updated_at = datetime.now(UTC)
        await self.repository.commit()
        return profile

    async def record_feedback(
        self, user: AuthUser, product_id: str, event: str, user_id: str | None
    ) -> InteractionRecord:
        # Solo ADMIN/SERVICE pueden registrar a nombre de otro usuario
        owner = user_id if user_id and {"ADMIN", "SERVICE"} & set(user.roles) else user.id
        record = await self.repository.add(
            InteractionRecord(
                user_id=owner, product_id=product_id, event=event, weight=EVENT_WEIGHTS[event]
            )
        )
        await self.repository.commit()
        await self.repository.refresh(record)
        return record

    async def delete_interaction(self, user: AuthUser, interaction_id: str) -> None:
        if (record := await self.repository.get(interaction_id)) is None:
            raise InteractionNotFoundError(interaction_id)
        ensure_owner(user, record.user_id)  # Derecho de supresión: cada usuario borra lo suyo
        await self.repository.delete(record)
        await self.repository.commit()

    async def enqueue_training(self) -> tuple[PersonalizationModel, str]:
        model = PersonalizationModel(version=await self.repository.next_version())
        await self.repository.save(model)
        await self.repository.commit()
        return model, celery_app.send_task(TRAIN_TASK, args=[model.id]).id

    async def run_training(self, model_id: str) -> None:
        if (row := await self.repository.model(model_id)) is None:
            return
        row.status = JobStatus.RUNNING
        await self.repository.commit()
        try:
            signals = await self.repository.signals()
            model = await asyncio.to_thread(collaborative_filter.fit, signals)
            if model is None:
                raise ValueError("Se necesitan interacciones de al menos 2 usuarios y 2 productos")
            path = get_settings().MODEL_DIR / "personalization" / f"v{row.version}.joblib"
            path.parent.mkdir(parents=True, exist_ok=True)
            await asyncio.to_thread(joblib.dump, model, path)
            row.metrics = {
                "users": len(model.user_index),
                "products": len(model.item_ids),
                "hit_rate@10": await asyncio.to_thread(hit_rate, signals),
            }
            row.artifact_path, row.status, row.trained_at = (
                str(path),
                JobStatus.DONE,
                datetime.now(UTC),
            )
        except Exception as error:
            row.status, row.error = JobStatus.FAILED, str(error)
        await self.repository.commit()
