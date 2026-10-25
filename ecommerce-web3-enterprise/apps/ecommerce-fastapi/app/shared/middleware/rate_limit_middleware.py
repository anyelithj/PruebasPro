# rate_limit_middleware.py (FastAPI + Redis) => límite de peticiones por usuario en ventana fija
# (INCR + EXPIRE). Lo usa el asistente LLM (Plan 5B.5): cada mensaje cuesta CPU/GPU, así un usuario
# no acapara el modelo local. Si Redis no responde se permite la petición (falla abierta: el límite
# protege recursos, no datos).
# Patrón: Guard (dependencia que corta antes del endpoint) + Factory (rate_limit fabrica un guard
# por prefijo y límite). Paradigma: funcional (closure) + asíncrono.

from collections.abc import Awaitable, Callable

from redis.exceptions import RedisError

from app.config.redis_config import get_redis
from app.shared.middleware.auth_middleware import AuthUser, CurrentUser
from app.shared.middleware.error_middleware import AppError


def rate_limit(prefix: str, limit: int, window_seconds: int = 60) -> Callable[..., Awaitable[None]]:
    async def guard(user: CurrentUser) -> None:
        if await _hits(prefix, user, window_seconds) > limit:
            raise AppError(429, "RATE_LIMITED", "Demasiadas solicitudes: intenta en un minuto")

    return guard


async def _hits(prefix: str, user: AuthUser, window_seconds: int) -> int:
    key = f"ml:ratelimit:{prefix}:{user.id}"
    try:
        # "pipeline" => INCR + EXPIRE en un solo viaje; "nx=True" => el TTL se fija solo en la
        # primera petición de la ventana (no se extiende con cada mensaje)
        async with get_redis().pipeline(transaction=True) as pipe:
            pipe.incr(key)
            pipe.expire(key, window_seconds, nx=True)
            count, _ = await pipe.execute()
        return int(count)
    except RedisError:
        return 0
