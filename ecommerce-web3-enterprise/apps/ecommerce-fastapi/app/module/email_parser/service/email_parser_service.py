# email_parser_service.py (spaCy + embeddings) => casos de uso: analizar un correo (limpieza + NER +
# intención), consultarlo, listar entidades y limpiar la caché.
# Patrón: Service Layer + Facade (preprocesado, NER e intención detrás de una operación) + Cache-
# Aside. Paradigma: POO (DIP) + asíncrono.

from app.module.email_parser.exception.email_parser_exception import (
    ParsedEmailNotFoundError,
    ParseFailedError,
)
from app.module.email_parser.ml import ner_extractor
from app.module.email_parser.ml.email_preprocessor import preprocess
from app.module.email_parser.ml.intent_classifier import email_intent_classifier
from app.module.email_parser.model.email_parser_model import ExtractedEntity, ParsedEmail
from app.module.email_parser.repository.email_parser_repository import EmailParserRepository
from app.shared.decorator.cache_decorator import content_hash
from app.shared.util.model_cache import run_model
from app.shared.util.pagination_util import PageParams


class EmailParserService:
    def __init__(self, repository: EmailParserRepository) -> None:
        self.repository = repository

    async def parse(self, raw: str | None, subject: str, body: str, sender: str) -> ParsedEmail:
        email = preprocess(raw, subject, body, sender)
        if not email.text:
            raise ParseFailedError()
        text_hash = content_hash(email.subject, email.sender, email.text)
        if (cached := await self.repository.by_hash(text_hash)) is not None:
            return cached
        # Intención con asunto + cuerpo (el asunto suele resumir el motivo del correo)
        intent, score = await run_model(
            email_intent_classifier().classify,
            f"{email.subject}. {email.text}",
            engine="de lenguaje (Ollama)",
        )
        entities = [ExtractedEntity(**entity) for entity in ner_extractor.extract(email.text)]
        parsed = ParsedEmail(
            text_hash=text_hash,
            subject=email.subject,
            sender=email.sender,
            excerpt=email.text[:500],
            intent=intent,
            intent_score=score,
            entities=entities,
        )
        await self.repository.add(parsed)
        await self.repository.commit()
        return parsed

    async def get(self, email_id: str) -> ParsedEmail:
        if (email := await self.repository.get(email_id)) is None:
            raise ParsedEmailNotFoundError(email_id)
        return email

    async def list_entities(self, label: str | None, params: PageParams):
        return await self.repository.list_entities(label, params)

    async def clear_cache(self) -> int:
        # Las entidades se borran por ON DELETE CASCADE
        deleted = await self.repository.delete_all()
        await self.repository.commit()
        return deleted
