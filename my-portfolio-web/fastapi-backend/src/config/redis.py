"""[SRP] conexión Redis aislada — pool async reutilizable."""

from redis.asyncio import Redis, from_url

from src.config.settings import settings

redis_client: Redis = from_url(
    settings.redis_url,
    encoding="utf-8",
    decode_responses=True,
)


async def close_redis() -> None:
    await redis_client.aclose()
