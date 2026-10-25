# email_parser_controller.py (FastAPI + Strawberry) => traduce HTTP/GraphQL <-> casos de uso del
# analizador de correos. Patrón: Controller + DI + Adapter (GraphQL). Paradigma: asíncrono.

from typing import Annotated

import strawberry
from fastapi import Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.scalars import JSON

from app.config.database_config import get_session
from app.module.email_parser.repository.email_parser_repository import EmailParserRepository
from app.module.email_parser.schema.email_parser_schema import (
    ExtractedEntityItem,
    ParsedEmailResponse,
    ParseRequest,
)
from app.module.email_parser.service.email_parser_service import EmailParserService
from app.shared.types.common_types import ApiResponse
from app.shared.util.pagination_util import Page


def build_service(session: AsyncSession) -> EmailParserService:
    return EmailParserService(EmailParserRepository(session))


def get_service(session: Annotated[AsyncSession, Depends(get_session)]) -> EmailParserService:
    return build_service(session)


Service = Annotated[EmailParserService, Depends(get_service)]


# createParsedEmail() — POST /parse
async def create_parsed_email(
    body: ParseRequest, service: Service
) -> ApiResponse[ParsedEmailResponse]:
    parsed = await service.parse(body.raw, body.subject, body.body, body.sender)
    return ApiResponse(data=ParsedEmailResponse.model_validate(parsed))


# listExtractedEntitys() — GET /extracted?label=&page=&limit=
async def list_extracted_entities(
    service: Service, params: Page, label: Annotated[str | None, Query(max_length=32)] = None
) -> ApiResponse[list[ExtractedEntityItem]]:
    rows, meta = await service.list_entities(label, params)
    return ApiResponse(data=[ExtractedEntityItem.model_validate(row) for row in rows], meta=meta)


# getParsedEmailById() — GET /:id
async def get_parsed_email_by_id(
    email_id: str, service: Service
) -> ApiResponse[ParsedEmailResponse]:
    return ApiResponse(data=ParsedEmailResponse.model_validate(await service.get(email_id)))


# deleteAllParsedEmails() — DELETE /parsing-cache
async def delete_all_parsed_emails(service: Service) -> ApiResponse[dict[str, int]]:
    return ApiResponse(data={"deleted": await service.clear_cache()})


# --- GraphQL ---
@strawberry.type
class ParsedEmailType:
    id: str
    subject: str
    intent: str
    intent_score: float
    entities: JSON


@strawberry.type
class EmailParserQuery:
    @strawberry.field
    async def parsed_email(self, info: strawberry.Info, id: str) -> ParsedEmailType:
        dto = ParsedEmailResponse.model_validate(
            await build_service(info.context["session"]).get(id)
        )
        return ParsedEmailType(
            id=dto.id,
            subject=dto.subject,
            intent=dto.intent,
            intent_score=dto.intent_score,
            entities=[entity.model_dump() for entity in dto.entities],
        )
