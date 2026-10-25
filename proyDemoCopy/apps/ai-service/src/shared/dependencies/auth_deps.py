"""Dependencies de autenticación para inyectar via FastAPI Depends.

[Patrón]: Dependency Injection + Strategy.
[Principio]: DIP — endpoints reciben CurrentUser, no manipulan JWT.
[Paradigma]: Funcional + asíncrono.
"""
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header

from src.shared.exceptions.custom_errors import UnauthorizedDomainError
from src.shared.middleware.auth_middleware import decode_access_token


@dataclass(frozen=True)
class CurrentUser:
    """Snapshot inmutable del usuario autenticado. [Patrón]: Value Object."""

    id: str
    email: str
    role: str


def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    """Extrae y valida el JWT del header Authorization.

    [Principio]: SRP — solo provee CurrentUser; lógica de negocio aparte.
    """
    if not authorization:
        raise UnauthorizedDomainError("Missing Authorization header")

    # [Bearer scheme]: rechaza otros esquemas (Basic, Digest)
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedDomainError("Invalid Authorization scheme; use Bearer")

    payload = decode_access_token(token)
    return CurrentUser(
        id=str(payload["sub"]),
        email=str(payload.get("email", "")),
        role=str(payload.get("role", "USER")),
    )


# [Alias tipado]: usar en handlers como `user: CurrentUserDep` | [Principio]: DRY
CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


def require_role(*allowed_roles: str):
    """Factory de dependency que valida que el usuario tenga uno de los roles.

    [Patrón]: Higher-Order Function — devuelve una dependency parametrizada.
    """

    def checker(user: CurrentUserDep) -> CurrentUser:
        if user.role not in allowed_roles:
            from src.shared.exceptions.custom_errors import ForbiddenDomainError

            raise ForbiddenDomainError(
                f"Required role: {' | '.join(allowed_roles)}. Current: {user.role}"
            )
        return user

    return checker
