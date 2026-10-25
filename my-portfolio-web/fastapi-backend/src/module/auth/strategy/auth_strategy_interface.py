"""[DIP][ISP] ABC de autenticación — authenticate(credentials) → UserModel."""

from abc import ABC, abstractmethod
from typing import Any

from src.module.user.model.user_model import UserModel


class IAuthStrategy(ABC):
    @abstractmethod
    async def authenticate(self, credentials: dict[str, Any]) -> UserModel:
        """Devuelve el usuario autenticado o lanza UnauthorizedException."""
        raise NotImplementedError
