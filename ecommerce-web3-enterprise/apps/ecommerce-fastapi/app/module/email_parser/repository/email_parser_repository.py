# email_parser_repository.py (SQLAlchemy async) => acceso a datos de correos y entidades extraídas.
# Patrón: Repository (hereda SqlRepository). Paradigma: asíncrono + POO.

from sqlalchemy import select

from app.config.database_config import SqlRepository
from app.module.email_parser.model.email_parser_model import ExtractedEntity, ParsedEmail
from app.shared.types.common_types import PageMeta
from app.shared.util.pagination_util import PageParams, paginate


class EmailParserRepository(SqlRepository[ParsedEmail]):
    entity = ParsedEmail

    async def by_hash(self, text_hash: str) -> ParsedEmail | None:
        query = select(ParsedEmail).where(ParsedEmail.text_hash == text_hash)
        return (await self.session.execute(query)).scalar_one_or_none()

    async def list_entities(
        self, label: str | None, params: PageParams
    ) -> tuple[list[ExtractedEntity], PageMeta]:
        query = select(ExtractedEntity).order_by(ExtractedEntity.id)
        if label:
            query = query.where(ExtractedEntity.label == label)
        return await paginate(self.session, query, params)
