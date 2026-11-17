"""Adaptadores del puerto ConversationRepository: Redis (con TTL) e InMemory (respaldo / pruebas).

[Patrón]: Repository + Adapter + Mapper (Conversation ⇄ JSON) + Factory (`build_conversation_repository`).
[Principio]: SRP + DIP — los casos de uso dependen del puerto `ConversationRepository`.
[Paradigma]: POO + asíncrono (`async/await`).
[2026-11-13 · Tarea 1 · RNF-06]: antes el estado vivía SOLO en la memoria del proceso (se perdía al reiniciar y no se
compartía entre workers). Ahora: Redis con TTL; si Redis no responde al arrancar, memoria con aviso (Fail Soft en desarrollo).
El Tutor IA y el avatar de diálogos ya no dependen de este almacén: NestJS envía el historial guardado en PostgreSQL.
"""

import json
import logging
from datetime import datetime
from typing import Protocol

from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.interfaces.conversation_repository import ConversationRepository
from src.modules.assistant.domain.value_objects.message import Message

logger = logging.getLogger(__name__)
_PREFIX = "aula:conversation:"  # Espacio de nombres de las claves en Redis (no choca con otras apps del mismo Redis)


class InMemoryConversationRepository:
    """Diccionario del proceso: un solo worker, se pierde al reiniciar → solo pruebas y desarrollo sin Redis."""

    def __init__(self) -> None:
        self._store: dict[str, Conversation] = {}

    async def find(self, conversation_id: str) -> Conversation | None:
        return self._store.get(conversation_id)

    async def save(self, conversation: Conversation) -> Conversation:
        self._store[conversation.id] = conversation
        return conversation

    # [Sprint 7.9]: el usuario borra su conversación con el Agente Guía (DELETE /assistant/conversation/{id})
    async def delete(self, conversation_id: str) -> bool:
        return self._store.pop(conversation_id, None) is not None  # `pop(k, None)`: no lanza si no existe


class AsyncKeyValue(Protocol):
    """Subconjunto de `redis.asyncio.Redis` que usa el adaptador → en pruebas basta un doble en memoria (ISP)."""

    async def get(self, name: str) -> bytes | str | None: ...

    async def set(self, name: str, value: str, ex: int | None = None) -> object: ...

    async def delete(self, *names: str) -> int: ...


def to_json(conv: Conversation) -> str:
    """Conversation → JSON. `isoformat()` conserva la zona horaria. [Patrón]: Mapper | función pura."""
    return json.dumps(
        {
            "id": conv.id,
            "user_id": conv.user_id,
            "created_at": conv.created_at.isoformat(),
            "messages": [{"role": m.role, "content": m.content, "timestamp": m.timestamp.isoformat()} for m in conv.messages],
        },
        ensure_ascii=False,  # Conserva tildes y ñ legibles en Redis
    )


def from_json(raw: bytes | str) -> Conversation:
    """JSON → Conversation (inverso exacto de `to_json`). `fromisoformat` (stdlib) reconstruye las fechas."""
    data = json.loads(raw)
    return Conversation(
        id=data["id"],
        user_id=data["user_id"],
        created_at=datetime.fromisoformat(data["created_at"]),
        messages=[Message(m["role"], m["content"], datetime.fromisoformat(m["timestamp"])) for m in data["messages"]],
    )


class RedisConversationRepository:
    """Conversación serializada en una clave con TTL: compartida por todos los workers y caduca sola (sin limpieza manual)."""

    def __init__(self, client: AsyncKeyValue, ttl_seconds: int) -> None:
        self._client = client  # [DI]: redis.asyncio.Redis en producción, doble en memoria en pruebas
        self._ttl = ttl_seconds

    async def find(self, conversation_id: str) -> Conversation | None:
        raw = await self._client.get(_PREFIX + conversation_id)
        return from_json(raw) if raw is not None else None

    async def save(self, conversation: Conversation) -> Conversation:
        # `ex=` (Redis SET EX): cada turno renueva el TTL → caduca tras N segundos SIN actividad
        await self._client.set(_PREFIX + conversation.id, to_json(conversation), ex=self._ttl)
        return conversation

    async def delete(self, conversation_id: str) -> bool:
        return await self._client.delete(_PREFIX + conversation_id) > 0  # DEL devuelve cuántas claves borró


def build_conversation_repository(redis_url: str, ttl_seconds: int) -> ConversationRepository:
    """[Factory]: Redis si responde al arrancar; si no, memoria con aviso (el servicio sigue funcionando en desarrollo)."""
    try:
        import redis  # Import diferido: el servicio arranca aunque falte la librería (cae a memoria)
        import redis.asyncio

        redis.Redis.from_url(redis_url, socket_connect_timeout=1).ping()  # Comprobación síncrona y rápida (1 s)
        return RedisConversationRepository(redis.asyncio.Redis.from_url(redis_url), ttl_seconds)
    except Exception as exc:  # noqa: BLE001 — cualquier fallo de conexión → respaldo en memoria
        logger.warning("Redis no disponible (%s): conversaciones en memoria del proceso", exc)
        return InMemoryConversationRepository()
