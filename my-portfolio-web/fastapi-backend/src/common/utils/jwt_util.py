"""[FP][SRP] encode/decode JWT puros — reciben claims, devuelven token/claims."""

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from src.config.settings import settings


def encode_token(claims: dict[str, Any], expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {**claims, "iat": now, "exp": now + expires_delta}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """Lanza jwt.PyJWTError (ExpiredSignatureError, InvalidTokenError) si es inválido."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
