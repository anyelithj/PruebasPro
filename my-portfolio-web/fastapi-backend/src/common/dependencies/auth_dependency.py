"""[DI][GUARD][SRP] get_current_user → UserModel. Verifica Bearer JWT antes del endpoint."""

import uuid
from collections.abc import Callable
from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.common.constants.app_constants import TOKEN_TYPE_ACCESS
from src.common.dependencies.db_dependency import DbSession
from src.common.exceptions.forbidden_exception import ForbiddenException
from src.common.exceptions.validation_exception import UnauthorizedException
from src.common.utils.jwt_util import decode_token
from src.module.user.model.user_model import UserModel
from src.module.user.repository.user_repository import UserRepository

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    session: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> UserModel:
    if credentials is None:
        raise UnauthorizedException("Missing bearer token")
    try:
        payload = decode_token(credentials.credentials)
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedException("Token expired") from exc
    except jwt.PyJWTError as exc:
        raise UnauthorizedException("Invalid token") from exc

    if payload.get("type") != TOKEN_TYPE_ACCESS:
        raise UnauthorizedException("Invalid token type")

    user = await UserRepository(session).get_by_id(uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise UnauthorizedException("User not found or inactive")
    return user


CurrentUser = Annotated[UserModel, Depends(get_current_user)]


def require_roles(*roles: str) -> Callable[[UserModel], UserModel]:
    """[GUARD] factory: exige que el usuario tenga uno de los roles dados."""

    async def _guard(user: CurrentUser) -> UserModel:
        if roles and user.role not in roles:
            raise ForbiddenException("Insufficient role")
        return user

    return _guard
