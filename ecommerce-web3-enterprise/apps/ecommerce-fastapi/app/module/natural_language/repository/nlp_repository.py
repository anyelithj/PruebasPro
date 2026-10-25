# nlp_repository.py (SQLAlchemy async) => acceso a datos de sesiones de chat, respuestas y análisis.
# Patrón: Repository (hereda SqlRepository; la raíz es ChatSession). Paradigma: asíncrono + POO.

from sqlalchemy import select

from app.config.database_config import SqlRepository
from app.module.natural_language.model.nlp_model import (
    ChatSession,
    LlmResponse,
    NlpResult,
    NluTrainingExample,
)
from app.shared.types.common_types import PageMeta
from app.shared.util.pagination_util import PageParams, paginate


class NlpRepository(SqlRepository[ChatSession]):
    entity = ChatSession

    # save => agrega cualquier entidad del módulo a la Unit of Work (NlpResult, LlmResponse)
    async def save(self, instance: NlpResult | LlmResponse | NluTrainingExample) -> None:
        self.session.add(instance)
        await self.session.flush()

    # ---------- RF-17.13 ejemplos de entrenamiento ----------
    async def approved_examples(self) -> list[NluTrainingExample]:
        query = select(NluTrainingExample).where(NluTrainingExample.approved.is_(True))
        rows = await self.session.execute(query.order_by(NluTrainingExample.created_at))
        return list(rows.scalars())

    async def training_page(
        self, approved: bool | None, params: PageParams
    ) -> tuple[list[NluTrainingExample], PageMeta]:
        query = select(NluTrainingExample).order_by(NluTrainingExample.created_at.desc())
        if approved is not None:
            query = query.where(NluTrainingExample.approved.is_(approved))
        return await paginate(self.session, query, params)

    async def example(self, example_id: str) -> NluTrainingExample | None:
        return await self.session.get(NluTrainingExample, example_id)

    async def remove(self, instance: NluTrainingExample) -> None:
        await self.session.delete(instance)
