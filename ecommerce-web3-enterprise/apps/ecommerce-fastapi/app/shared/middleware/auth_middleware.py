# auth_middleware.py (FastAPI + biblioteca estándar) => valida el JWT de acceso emitido por Express
# (HS256) y aplica RBAC. Patrón: Guard (dependencia que corta la petición antes del endpoint) +
# Factory (require_roles fabrica un guard por roles).
# Paradigma: funcional (funciones puras de decodificación) + inyección de dependencias de FastAPI
# (Depends). Se implementa con hmac/hashlib/base64 de la biblioteca estándar: HS256 son ~15 líneas y
# evita sumar una dependencia.

import base64  # Decodifica Base64URL (formato de cada segmento del JWT)
import hashlib  # SHA-256 para la firma HMAC
import hmac  # Firma HMAC y comparación en tiempo constante
import json  # Parseo del header/payload del JWT
import time  # Hora actual (validación de "exp")
from collections.abc import Callable  # Tipo de una función (lo que devuelve require_roles)
from dataclasses import dataclass, field  # Clase de datos inmutable (Value Object)
from typing import Annotated  # Annotated[T, Depends(...)] => tipo + metadato de inyección

# Depends => inyección de dependencias; Header => lee cabeceras HTTP
from fastapi import Depends, Header

from app.config.app_config import get_settings
from app.shared.middleware.error_middleware import AppError  # Excepción base con status y código


# "@dataclass(frozen=True)" => Value Object inmutable: el usuario autenticado no se modifica dentro
# del request
@dataclass(frozen=True)
class AuthUser:
    id: str  # Claim "sub" (ID del usuario en Express)
    email: str
    roles: tuple[str, ...]  # Tupla (inmutable) de nombres de rol: ("ADMIN",)
    # JWT original: el asistente LLM lo reenvía a Express en cada herramienta (permisos del propio
    # usuario). "repr=False" => nunca aparece en logs ni trazas
    token: str = field(default="", repr=False)


# _b64url_decode => los segmentos JWT usan Base64URL SIN relleno "="; se restaura antes de
# decodificar
def _b64url_decode(segment: str) -> bytes:
    return base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4))


# decode_access_token => función pura: devuelve el usuario o lanza AppError 401 (mismas reglas que
# jwt.strategy.ts)
def decode_access_token(token: str) -> AuthUser:
    settings = get_settings()
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")  # Desempaqueta los 3 segmentos
        header = json.loads(_b64url_decode(header_b64))
        payload = json.loads(_b64url_decode(payload_b64))
        signature = _b64url_decode(signature_b64)
    except ValueError as error:  # Formato inválido (no son 3 segmentos o no es JSON/Base64)
        raise AppError(401, "INVALID_TOKEN", "Token inválido") from error

    # Solo HS256: rechaza "alg: none" y algoritmos no esperados (ataque de confusión de algoritmo)
    if header.get("alg") != "HS256":
        raise AppError(401, "INVALID_TOKEN", "Token inválido")
    expected = hmac.new(
        settings.JWT_ACCESS_SECRET.encode(), f"{header_b64}.{payload_b64}".encode(), hashlib.sha256
    ).digest()
    # "compare_digest" => comparación en tiempo constante (evita ataques de temporización)
    if not hmac.compare_digest(expected, signature):
        raise AppError(401, "INVALID_TOKEN", "Token inválido")
    if payload.get("iss") != settings.JWT_ISSUER:
        raise AppError(401, "INVALID_TOKEN", "Token inválido")
    if not isinstance(payload.get("exp"), int | float) or payload["exp"] < time.time():
        raise AppError(401, "TOKEN_EXPIRED", "Token expirado")
    return AuthUser(
        id=str(payload["sub"]),
        email=str(payload.get("email", "")),
        roles=tuple(payload.get("roles", [])),
        token=token,
    )


# get_current_user => dependencia FastAPI: lee "Authorization: Bearer <token>"
# "Header(default=None)" => FastAPI inyecta la cabecera; None si no viene
def get_current_user(authorization: str | None = Header(default=None)) -> AuthUser:
    # Guard clause: sin cabecera o sin esquema Bearer => 401
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError(401, "UNAUTHORIZED", "Autenticación requerida")
    return decode_access_token(authorization.removeprefix("Bearer "))


# require_roles => Factory de guards RBAC: require_roles("ADMIN") devuelve una dependencia lista
# para Depends
def require_roles(*roles: str) -> Callable[[AuthUser], AuthUser]:
    # Closure (programación funcional): "roles" queda capturado en la función interna
    def guard(user: Annotated[AuthUser, Depends(get_current_user)]) -> AuthUser:
        # "any(...)" => basta con tener uno de los roles permitidos
        if not any(role in user.roles for role in roles):
            raise AppError(403, "FORBIDDEN", "No tienes permisos para esta acción")
        return user

    return guard


# CurrentUser => alias para controllers: "user: CurrentUser" exige cualquier JWT válido de Express
CurrentUser = Annotated[AuthUser, Depends(get_current_user)]


# ensure_owner => regla de autorización por recurso: el dueño, o un ADMIN/SERVICE, puede acceder
# (evita que un cliente lea el chat o las recomendaciones de otro: IDOR)
def ensure_owner(user: AuthUser, owner_id: str | None) -> None:
    if user.id != owner_id and not {"ADMIN", "SERVICE"} & set(user.roles):  # "&" => intersección
        raise AppError(403, "FORBIDDEN", "No tienes permisos para este recurso")
