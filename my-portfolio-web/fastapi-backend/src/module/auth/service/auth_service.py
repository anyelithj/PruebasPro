"""[SRP][OOP] orquesta login/register/refresh/logout/reset — strategy + token + repos."""

import hashlib
import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from src.common.exceptions.validation_exception import (
    ConflictException,
    UnauthorizedException,
)
from src.common.utils.hash_util import hash_password
from src.config.settings import get_settings
from src.module.auth.dto.forgot_password_dto import ForgotPasswordDto
from src.module.auth.dto.login_dto import LoginDto
from src.module.auth.dto.refresh_token_dto import RefreshTokenDto
from src.module.auth.dto.register_dto import RegisterDto
from src.module.auth.dto.reset_password_dto import ResetPasswordDto
from src.module.auth.dto.token_response_dto import TokenResponseDto
from src.module.auth.model.password_reset_token_model import PasswordResetTokenModel
from src.module.auth.model.session_model import SessionModel
from src.module.auth.repository.auth_repository import AuthRepository
from src.module.auth.service.token_service import TokenPair, TokenService
from src.module.auth.strategy.email_password_strategy import EmailPasswordStrategy
from src.module.user.dto.user_response_dto import UserResponseDto
from src.module.user.model.user_model import UserModel
from src.module.user.repository.user_repository import UserRepository

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(
        self,
        user_repository: UserRepository,
        auth_repository: AuthRepository,
        token_service: TokenService,
    ) -> None:
        self._users = user_repository
        self._sessions = auth_repository
        self._tokens = token_service
        self._strategy = EmailPasswordStrategy(user_repository)

    async def register(self, dto: RegisterDto) -> TokenResponseDto:
        if await self._users.get_by_email(dto.email):
            raise ConflictException("Email already registered")
        user = await self._users.add(
            UserModel(
                name=dto.name,
                email=dto.email,
                password_hash=hash_password(dto.password),
            )
        )
        return await self._issue(user)

    async def login(self, dto: LoginDto) -> TokenResponseDto:
        user = await self._strategy.authenticate(
            {"email": dto.email, "password": dto.password}
        )
        return await self._issue(user)

    async def refresh(self, dto: RefreshTokenDto) -> TokenResponseDto:
        try:
            payload = self._tokens.decode_refresh(dto.refresh_token)
        except jwt.PyJWTError as exc:
            raise UnauthorizedException("Invalid refresh token") from exc

        jti = payload.get("jti", "")
        session = await self._sessions.get_active_by_jti(jti)
        if session is None:
            raise UnauthorizedException("Session revoked or expired")

        user = await self._users.get_by_id(uuid.UUID(payload["sub"]))
        if user is None or not user.is_active:
            raise UnauthorizedException("User not found or inactive")

        # [SEC] rotación: revoca el jti usado antes de emitir uno nuevo.
        await self._sessions.revoke_by_jti(jti)
        return await self._issue(user)

    async def logout(self, dto: RefreshTokenDto) -> None:
        try:
            payload = self._tokens.decode_refresh(dto.refresh_token)
        except jwt.PyJWTError:
            return
        await self._sessions.revoke_by_jti(payload.get("jti", ""))

    # [SEC] respuesta idéntica exista o no el email: no filtra qué cuentas están registradas.
    async def forgot_password(self, dto: ForgotPasswordDto) -> None:
        user = await self._users.get_by_email(dto.email)
        if user is None or not user.is_active:
            return

        await self._sessions.invalidate_pending_password_resets(user.id)

        settings = get_settings()
        token = secrets.token_hex(32)
        await self._sessions.create_password_reset(
            PasswordResetTokenModel(
                user_id=user.id,
                token_hash=self._hash_token(token),
                expires_at=datetime.now(timezone.utc)
                + timedelta(minutes=settings.password_reset_ttl_min),
            )
        )

        # Sin servicio de correo todavía: el enlace se entrega por los logs del backend.
        logger.warning(
            "[password-reset] %s → %s/reset-password?token=%s (vence en %s min)",
            user.email,
            settings.frontend_url,
            token,
            settings.password_reset_ttl_min,
        )

    async def reset_password(self, dto: ResetPasswordDto) -> None:
        record = await self._sessions.get_valid_password_reset(self._hash_token(dto.token))
        if record is None:
            raise UnauthorizedException("Reset token invalid or expired")

        user = await self._users.get_by_id(record.user_id)
        if user is None:
            raise UnauthorizedException("Reset token invalid or expired")

        user.password_hash = hash_password(dto.password)
        await self._sessions.mark_password_reset_used(record.id)
        # Contraseña cambiada → toda sesión previa deja de valer.
        await self._sessions.revoke_all_by_user(user.id)

    # Se persiste el hash, nunca el token en claro: si se filtra la tabla, los enlaces siguen sin servir.
    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    async def _issue(self, user: UserModel) -> TokenResponseDto:
        pair: TokenPair = self._tokens.create_token_pair(user)
        await self._sessions.create_session(
            SessionModel(
                user_id=user.id,
                refresh_jti=pair.refresh_jti,
                expires_at=pair.refresh_expires_at,
            )
        )
        return TokenResponseDto(
            access_token=pair.access_token,
            refresh_token=pair.refresh_token,
            user=UserResponseDto.model_validate(user),
        )
