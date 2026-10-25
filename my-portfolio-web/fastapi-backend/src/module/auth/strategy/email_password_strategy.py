"""[STRATEGY][OCP] autentica con email + password sin romper el contrato IAuthStrategy."""

from typing import Any

from src.common.exceptions.validation_exception import UnauthorizedException
from src.common.utils.hash_util import verify_password
from src.module.auth.strategy.auth_strategy_interface import IAuthStrategy
from src.module.user.model.user_model import UserModel
from src.module.user.repository.user_repository import UserRepository


class EmailPasswordStrategy(IAuthStrategy):
    def __init__(self, user_repository: UserRepository) -> None:
        self._users = user_repository

    async def authenticate(self, credentials: dict[str, Any]) -> UserModel:
        email = credentials.get("email", "")
        password = credentials.get("password", "")
        user = await self._users.get_by_email(email)
        # [CC-C] mismo error para "no existe" y "password malo": evita user enumeration.
        if user is None or not verify_password(password, user.password_hash):
            raise UnauthorizedException("Invalid credentials")
        if not user.is_active:
            raise UnauthorizedException("User inactive")
        return user
