"""[STRATEGY][OCP] autenticación OAuth — stub en vertical slice, misma interfaz."""

from typing import Any

from src.common.exceptions.validation_exception import ValidationException
from src.module.auth.strategy.auth_strategy_interface import IAuthStrategy
from src.module.user.model.user_model import UserModel


class OAuthStrategy(IAuthStrategy):
    async def authenticate(self, credentials: dict[str, Any]) -> UserModel:
        # TODO(vertical-slice): intercambiar code por token con el provider y mapear usuario.
        raise ValidationException("OAuth login not implemented yet")
