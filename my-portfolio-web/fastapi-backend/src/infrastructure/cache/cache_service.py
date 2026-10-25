"""[FACADE][SRP] abstrae get/set/delete de Redis — el negocio no conoce la API cruda."""

import json
from typing import Any

from redis.asyncio import Redis

from src.config.redis import redis_client


class CacheService:
    """[FACADE] interfaz simple sobre Redis async."""

    def __init__(self, client: Redis) -> None:
        self._client = client

    async def get(self, key: str) -> Any | None:
        raw = await self._client.get(key)
        return json.loads(raw) if raw is not None else None

    async def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        await self._client.set(key, json.dumps(value), ex=ttl_seconds)

    async def delete(self, key: str) -> None:
        await self._client.delete(key)

    async def exists(self, key: str) -> bool:
        return bool(await self._client.exists(key))


def get_cache_service() -> CacheService:
    """[DI] provider del CacheService."""
    return CacheService(redis_client)
