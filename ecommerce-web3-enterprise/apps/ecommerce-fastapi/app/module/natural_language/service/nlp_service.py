# nlp_service.py (Ollama + LangChain + FAISS) => casos de uso: detectar intención/entidades,
# conversar con el asistente (RAG), gestionar sesiones de chat y el ENTRENAMIENTO CONTINUO.
# Patrón: Service Layer + Strategy por intención (plantilla o LLM) + Chain of Responsibility
# (intención -> respuesta sin LLM si alcanza -> RAG + LLM) + Builder (prompt con LangChain) +
# Observer entre procesos (versión de entrenamiento en Redis: cada worker recarga si cambió).
# Paradigma: POO (DIP) + asíncrono.
# Ahorro de energía: saludos, estado de pedido y paso a un asesor se responden con plantillas
# (0 tokens generados); el LLM solo se usa cuando hace falta redactar sobre el catálogo.
# RF-17.2 entidades (producto, cantidad, dirección), RF-17.9 ortografía y sinónimos, RF-17.10
# baja confianza, RF-17.12 métricas de precisión y RF-17.13 entrenamiento con conversaciones reales.

import time
from datetime import UTC, datetime
from typing import Any

from langchain_core.prompts import ChatPromptTemplate  # Builder de prompts con variables

from app.config.llm_config import get_llm_settings
from app.config.redis_config import get_redis
from app.module.natural_language.exception.nlp_exception import (
    ChatSessionNotFoundError,
    TrainingExampleNotFoundError,
)
from app.module.natural_language.ml import (
    context_manager,
    entity_extractor,
    llm_connector,
    nlu_metrics,
    rag_pipeline,
)
from app.module.natural_language.ml.intent_detector import (
    CHAT_INTENTS,
    PrototypeClassifier,
    chat_intent_classifier,
    merge_examples,
    set_learned_examples,
)
from app.module.natural_language.ml.query_normalizer import build_vocabulary, normalize_query
from app.module.natural_language.model.nlp_model import (
    ChatSession,
    LlmResponse,
    NlpResult,
    NluTrainingExample,
)
from app.module.natural_language.repository.nlp_repository import NlpRepository
from app.module.sentiment_analysis.ml.multilingual_model import get_encoder
from app.shared.middleware.auth_middleware import AuthUser, ensure_owner
from app.shared.types.common_types import PageMeta
from app.shared.util.model_cache import run_model
from app.shared.util.pagination_util import PageParams

ENGINE = "de lenguaje (Ollama)"
# Respuestas fijas por intención: no necesitan un LLM (respuesta inmediata y sin cómputo)
TEMPLATES = {
    "greeting": (
        "¡Hola! Soy el asistente de la tienda. Puedo ayudarte a encontrar productos, "
        "recomendarte opciones o resolver dudas de devoluciones."
    ),
    "order_status": (
        "Puedes ver el estado y el seguimiento de tus pedidos en Mi cuenta → Mis pedidos. "
        "Si algo no cuadra, cuéntame el número de pedido (ORD-...)."
    ),
    "human": (
        "Te comunico con un asesor: escríbenos desde Mi cuenta → Soporte y te responderemos "
        "lo antes posible."
    ),
}
RAG_INTENTS = {"product_search", "recommendation"}  # Solo estas consultan el catálogo
PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            "Eres el asistente de una tienda en línea. Responde en el idioma del cliente, en "
            "máximo 4 frases. Usa SOLO los productos del contexto; si no hay uno adecuado, dilo.\n"
            "Contexto del catálogo:\n{context}",
        ),
        ("placeholder", "{history}"),  # Ventana de turnos previos (Redis)
        ("human", "{question}"),
    ]
)
_ROLES = {"human": "user", "ai": "assistant", "system": "system"}  # LangChain -> formato Ollama
LOW_CONFIDENCE = 0.45  # RF-17.10 por debajo => se sugiere escalar a una persona
AUTO_APPROVE = 0.92  # RF-17.13 auto-entrenamiento solo con predicciones MUY seguras
VERSION_KEY = "nlu:training:version"  # Redis: cada proceso recarga los ejemplos si cambió


# _State => versión de ejemplos cargada en ESTE proceso + vocabulario del corrector (RF-17.9).
# Atributos de clase = estado compartido por el proceso (como un módulo), sin variables globales.
class _State:
    version: str | None = "unloaded"
    vocabulary: set[str] = build_vocabulary([t for ts in CHAT_INTENTS.values() for t in ts])


def _now() -> str:
    return datetime.now(UTC).isoformat()


class NlpService:
    def __init__(self, repository: NlpRepository) -> None:
        self.repository = repository

    # detect => corrige y amplía la consulta, detecta intención con su confianza y entidades.
    # Con "conversation_id" el mensaje REAL alimenta el entrenamiento continuo (RF-17.13)
    async def detect(self, text: str, conversation_id: str | None = None) -> NlpResult:
        await self._sync_training()
        normalized, corrections, expansions = normalize_query(text, _State.vocabulary)
        intent, score = await run_model(
            chat_intent_classifier().classify, normalized or text, engine=ENGINE
        )
        entities = entity_extractor.extract(text)
        result = NlpResult(text=text, intent=intent, intent_score=score, entities=entities)
        await self.repository.save(result)
        if conversation_id:
            await self.repository.save(
                NluTrainingExample(
                    text=text,
                    intent=intent,
                    predicted_intent=intent,
                    confidence=score,
                    entities=[{"label": e["label"], "text": e["text"]} for e in entities],
                    source="auto",
                    approved=score >= AUTO_APPROVE,
                    conversation_id=conversation_id,
                )
            )
        await self.repository.commit()
        await self.repository.refresh(result)
        # Atributos de la respuesta que NO se guardan (atributos Python sobre la entidad)
        result.normalized_text = normalized
        result.corrections = corrections
        result.expansions = expansions
        result.low_confidence = score < LOW_CONFIDENCE
        return result

    async def message(self, user: AuthUser, session_id: str | None, text: str) -> LlmResponse:
        chat = (
            await self._session(user, session_id)
            if session_id
            else await self.repository.add(ChatSession(user_id=user.id, messages=[]))
        )
        started = time.perf_counter()
        await self._sync_training()
        normalized, _, _ = normalize_query(text, _State.vocabulary)  # RF-17.9 ortografía
        query = normalized or text
        intent, _ = await run_model(chat_intent_classifier().classify, query, engine=ENGINE)
        sources: list[dict] = []
        if intent in TEMPLATES:
            answer, model = TEMPLATES[intent], "template"
        else:
            if intent in RAG_INTENTS:
                sources = await rag_pipeline.retrieve(self.repository.session, query)
            context = (
                "\n".join(f"- {doc['text']}" for doc in sources) or "(sin productos relacionados)"
            )
            prompt = PROMPT.format_messages(
                context=context, history=await self._history(chat.id), question=text
            )
            messages = [{"role": _ROLES[m.type], "content": str(m.content)} for m in prompt]
            answer, model = (
                await run_model(llm_connector.chat, messages, engine=ENGINE),
                get_llm_settings().OLLAMA_MODEL,
            )

        turn = [{"role": "user", "content": text}, {"role": "assistant", "content": answer}]
        # Lista NUEVA (no .append): SQLAlchemy detecta el cambio de una columna JSON por
        # reasignación
        chat.messages = [*chat.messages, *({**m, "at": _now()} for m in turn)]
        response = LlmResponse(
            session_id=chat.id,
            prompt=text,
            response=answer,
            intent=intent,
            sources=[{"product_id": d["product_id"], "score": d["score"]} for d in sources],
            model=model,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
        await self.repository.save(response)
        await self.repository.commit()
        await context_manager.append(chat.id, *turn)
        await self.repository.refresh(response)
        return response

    # ---------- RF-17.13 entrenamiento continuo ----------
    # _sync_training => si la versión en Redis cambió, recarga los ejemplos aprobados, rehace los
    # centroides (al próximo uso) y el vocabulario del corrector. Sin Redis: carga una vez.
    async def _sync_training(self) -> None:
        try:
            version = await get_redis().get(VERSION_KEY)
        except Exception:  # noqa: BLE001 — Redis caído: se usa lo cargado (degradación parcial)
            version = None if _State.version == "unloaded" else _State.version
        if version == _State.version:
            return
        learned: dict[str, list[str]] = {}
        for example in await self.repository.approved_examples():
            learned.setdefault(example.intent, []).append(example.text)
        set_learned_examples(learned)
        merged = merge_examples(CHAT_INTENTS, learned)
        _State.vocabulary = build_vocabulary([t for ts in merged.values() for t in ts])
        _State.version = version

    async def _bump(self) -> None:
        try:
            await get_redis().incr(VERSION_KEY)  # Los procesos recargan en su próxima consulta
        except Exception:  # noqa: BLE001
            _State.version = "unloaded"  # Al menos este proceso recarga

    async def training_page(
        self, approved: bool | None, params: PageParams
    ) -> tuple[list[NluTrainingExample], PageMeta]:
        return await self.repository.training_page(approved, params)

    async def add_example(
        self, text: str, intent: str, entities: list[dict[str, Any]]
    ) -> NluTrainingExample:
        example = NluTrainingExample(
            text=text, intent=intent, entities=entities, source="agent", approved=True
        )
        await self.repository.save(example)
        await self.repository.commit()
        await self._bump()
        return example

    # label => un asesor corrige la intención/entidades de un mensaje real y lo aprueba o lo saca
    async def label(self, example_id: str, changes: dict[str, Any]) -> NluTrainingExample:
        if (example := await self.repository.example(example_id)) is None:
            raise TrainingExampleNotFoundError(example_id)
        for field, value in changes.items():
            setattr(example, field, value)
        if "intent" in changes or "entities" in changes:
            example.source = "agent"
        await self.repository.commit()
        await self._bump()
        return example

    async def remove_example(self, example_id: str) -> None:
        if (example := await self.repository.example(example_id)) is None:
            raise TrainingExampleNotFoundError(example_id)
        await self.repository.remove(example)
        await self.repository.commit()
        await self._bump()

    # metrics => RF-17.12 exactitud de intenciones sobre el 20 % NO visto y F1 de entidades
    async def metrics(self) -> dict[str, Any]:
        examples = [
            {"text": e.text, "intent": e.intent, "entities": e.entities}
            for e in await self.repository.approved_examples()
        ]
        train, test = nlu_metrics.split(examples)
        learned: dict[str, list[str]] = {}
        for example in train:
            learned.setdefault(example["intent"], []).append(example["text"])
        classifier = PrototypeClassifier(merge_examples(CHAT_INTENTS, learned), get_encoder())
        intents = await run_model(
            nlu_metrics.intent_metrics, test, classifier.classify, engine=ENGINE
        )
        return {
            "examples": len(examples),
            "intents": intents,
            "entities": nlu_metrics.entity_metrics(examples, entity_extractor.extract),
        }

    async def _history(self, session_id: str) -> list[tuple[str, str]]:
        return [
            ("human" if m["role"] == "user" else "ai", m["content"])
            for m in await context_manager.history(session_id)
        ]

    async def _session(self, user: AuthUser, session_id: str) -> ChatSession:
        if (chat := await self.repository.get(session_id)) is None:
            raise ChatSessionNotFoundError(session_id)
        ensure_owner(user, chat.user_id)  # Un cliente solo ve sus propias conversaciones
        return chat

    async def get_session(self, user: AuthUser, session_id: str) -> ChatSession:
        return await self._session(user, session_id)

    async def delete_session(self, user: AuthUser, session_id: str) -> None:
        await self.repository.delete(await self._session(user, session_id))
        await self.repository.commit()
        await context_manager.clear(session_id)
