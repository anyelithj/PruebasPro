"""[SRP] límite de requests por IP — token bucket simple en Redis."""

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from src.config.redis import redis_client
from src.config.settings import settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        # Los endpoints blockchain tienen su propio cubo con límite estricto —
        # protege los fondos de prueba de Devnet/Sepolia de abusos.
        is_blockchain = "/blockchain" in request.url.path
        scope = "blockchain" if is_blockchain else "api"
        limit = (
            settings.blockchain_rate_limit_per_minute
            if is_blockchain
            else settings.rate_limit_per_minute
        )
        key = f"ratelimit:{scope}:{client_ip}"
        try:
            count = await redis_client.incr(key)
            if count == 1:
                await redis_client.expire(key, 60)
            if count > limit:
                return JSONResponse(
                    status_code=429,
                    content={
                        "success": False,
                        "error": {"code": "RATE_LIMITED", "message": "Too many requests"},
                        "data": None,
                    },
                )
        except Exception:
            # [CC-C] fail-open: si Redis cae, no bloqueamos tráfico legítimo.
            pass
        return await call_next(request)
