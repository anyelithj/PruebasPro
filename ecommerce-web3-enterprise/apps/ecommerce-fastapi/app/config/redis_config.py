# redis_config.py (redis-py asyncio) => cliente Redis compartido (contexto de chat, cachés con TTL).
# Patrón: Singleton (un pool de conexiones por proceso con lru_cache). Paradigma: asíncrono.

from functools import lru_cache

# Cliente asíncrono oficial (antes "aioredis", hoy dentro de redis-py)
from redis.asyncio import Redis

from app.config.app_config import get_settings


@lru_cache(maxsize=1)
def get_redis() -> Redis:
    # "decode_responses=True" => devuelve str en lugar de bytes (JSON directo)
    return Redis.from_url(get_settings().REDIS_URL, decode_responses=True)
