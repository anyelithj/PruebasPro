"""[Tarea 1 · RNF-06]: conversación en Redis (con TTL) sin perder datos al serializar; respaldo en memoria si Redis no responde.

[Patrón]: Test Double (Fake del cliente Redis) | [Herramienta]: pytest + pytest-asyncio
"""

import pytest

from src.modules.assistant.domain.entities.conversation import Conversation
from src.modules.assistant.domain.value_objects.message import Message
from src.modules.assistant.infrastructure.repositories.conversation_repository import (
    InMemoryConversationRepository,
    RedisConversationRepository,
    build_conversation_repository,
)


class FakeRedis:
    """Doble mínimo de redis.asyncio.Redis: guarda valor y TTL por clave."""

    def __init__(self) -> None:
        self.data: dict[str, str] = {}
        self.ttl: dict[str, int | None] = {}

    async def get(self, name: str) -> str | None:
        return self.data.get(name)

    async def set(self, name: str, value: str, ex: int | None = None) -> bool:
        self.data[name], self.ttl[name] = value, ex
        return True

    async def delete(self, *names: str) -> int:
        return sum(self.data.pop(n, None) is not None for n in names)


@pytest.mark.asyncio
async def test_redis_guarda_y_recupera_la_conversacion_igual_con_ttl() -> None:
    fake = FakeRedis()
    repo = RedisConversationRepository(fake, ttl_seconds=60)
    conv = Conversation(id="c1", user_id="u1")
    conv.append(Message.assistant("Hi! I'm Aula. What's your name?"))
    conv.append(Message.user("Me llamo Laura, soy de Colombia — ñandú"))
    await repo.save(conv)

    loaded = await repo.find("c1")
    assert loaded == conv  # dataclass: igualdad campo a campo (mensajes, fechas con zona horaria)
    assert fake.ttl["aula:conversation:c1"] == 60  # Caduca sola
    assert "ñandú" in fake.data["aula:conversation:c1"]  # ensure_ascii=False
    assert await repo.delete("c1") is True
    assert await repo.find("c1") is None
    assert await repo.delete("c1") is False


def test_sin_redis_cae_a_memoria() -> None:
    repo = build_conversation_repository("redis://127.0.0.1:1/0", 60)  # Puerto cerrado → no responde
    assert isinstance(repo, InMemoryConversationRepository)
