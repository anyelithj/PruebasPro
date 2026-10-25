# cache_decorator.py (Redis + functools) => evita recalcular resultados ya conocidos (ahorro de CPU
# y energía): hash de contenido para cachés en BD y decorador de caché en Redis con TTL.
# Patrón: Decorator (envuelve una corrutina sin modificarla) + Cache-Aside. Paradigma: funcional.

import functools
import hashlib
import json
from collections.abc import Awaitable, Callable
from typing import Any

from redis.exceptions import RedisError  # Base de los errores de redis-py (conexión, timeout...)

from app.config.redis_config import get_redis


# content_hash => huella SHA-256 estable de un contenido (mismo texto => misma clave de caché)
def content_hash(*parts: str) -> str:
    return hashlib.sha256("\x1f".join(parts).strip().lower().encode()).hexdigest()


# redis_cached => decorador con parámetros: "@redis_cached('sentiment:aggregate', ttl=300)".
# La clave incluye los argumentos con nombre (keyword-only en las funciones decoradas) y el valor
# se guarda como JSON. Si Redis no responde, se calcula igual (la caché nunca rompe la API).
def redis_cached(prefix: str, ttl: int) -> Callable:
    def decorator(function: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        @functools.wraps(function)  # Conserva nombre y docstring de la función original
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            key = f"ml:{prefix}:{content_hash(json.dumps(kwargs, sort_keys=True, default=str))}"
            redis = get_redis()
            try:
                if (hit := await redis.get(key)) is not None:  # ":=" => asigna y evalúa a la vez
                    return json.loads(hit)
                value = await function(*args, **kwargs)
                # "ex" => TTL en segundos
                await redis.set(key, json.dumps(value, default=str), ex=ttl)
                return value
            except RedisError:
                return await function(*args, **kwargs)

        return wrapper

    return decorator
