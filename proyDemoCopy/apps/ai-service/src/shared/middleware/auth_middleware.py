"""JWT verification helper compartido entre dependencies y middleware opcional.

[Patrón]: Adapter (jose JWT) + Strategy.
[Principio]: SRP — solo decodifica y valida firma/expiración.
[Paradigma]: Funcional + asíncrono.
"""
from typing import Any

from jose import JWTError, jwt

from src.shared.config.settings import get_settings
from src.shared.exceptions.custom_errors import UnauthorizedDomainError


def decode_access_token(token: str) -> dict[str, Any]:
    """Decodifica un access token emitido por NestJS.

    Lanza UnauthorizedDomainError si el JWT es inválido o expirado.
    """
    settings = get_settings()
    try:
        # [Verify firma + exp]: jose lanza JWTError si firma inválida o token expirado
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.jwt_access_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:
        raise UnauthorizedDomainError("Invalid or expired access token") from exc

    if "sub" not in payload:
        raise UnauthorizedDomainError("Token payload missing 'sub'")

    return payload
