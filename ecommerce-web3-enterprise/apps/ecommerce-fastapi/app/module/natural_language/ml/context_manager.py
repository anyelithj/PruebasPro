# context_manager.py (Redis) => memoria de corto plazo del chat: últimos turnos de cada sesión con
# expiración automática. El LLM recibe solo esta ventana (no todo el historial): prompts más cortos
# = menos tokens procesados = menos energía por respuesta.
# Patrón: Observer (cada mensaje nuevo actualiza el contexto) + Cache con TTL. Paradigma: asíncrono.

import json

from redis.exceptions import RedisError

from app.config.redis_config import get_redis

WINDOW = 6  # Últimos 6 mensajes (3 turnos usuario/asistente)
TTL_SECONDS = 1800  # 30 min sin actividad => el contexto se borra solo


def _key(session_id: str) -> str:
    return f"ml:chat:{session_id}"


async def history(session_id: str) -> list[dict[str, str]]:
    try:
        return [json.loads(item) for item in await get_redis().lrange(_key(session_id), 0, -1)]
    except RedisError:  # Sin Redis el chat sigue funcionando, solo sin memoria de turnos
        return []


async def append(session_id: str, *messages: dict[str, str]) -> None:
    key = _key(session_id)
    try:
        # "pipeline" => envía RPUSH + LTRIM + EXPIRE en un solo viaje de red
        async with get_redis().pipeline(transaction=True) as pipe:
            pipe.rpush(key, *(json.dumps(m, ensure_ascii=False) for m in messages))
            pipe.ltrim(key, -WINDOW, -1)
            pipe.expire(key, TTL_SECONDS)
            await pipe.execute()
    except RedisError:
        pass  # El historial completo sigue en PostgreSQL (ChatSession)


async def clear(session_id: str) -> None:
    try:
        await get_redis().delete(_key(session_id))
    except RedisError:
        pass
