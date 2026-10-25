"""[SRP][FP] creación y verificación de tokens — access + refresh con jti para rotación."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt

from src.common.constants.app_constants import TOKEN_TYPE_ACCESS, TOKEN_TYPE_REFRESH
from src.common.utils.jwt_util import decode_token, encode_token
from src.config.settings import settings
from src.module.user.model.user_model import UserModel


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str
    refresh_jti: str
    refresh_expires_at: datetime


class TokenService:
    def create_access_token(self, user: UserModel) -> str:
        claims = {"sub": str(user.id), "role": user.role, "type": TOKEN_TYPE_ACCESS}
        return encode_token(claims, timedelta(minutes=settings.jwt_access_ttl_min))

    def create_token_pair(self, user: UserModel) -> TokenPair:
        jti = uuid.uuid4().hex
        refresh_delta = timedelta(days=settings.jwt_refresh_ttl_days)
        refresh_claims = {"sub": str(user.id), "type": TOKEN_TYPE_REFRESH, "jti": jti}
        refresh_token = encode_token(refresh_claims, refresh_delta)
        return TokenPair(
            access_token=self.create_access_token(user),
            refresh_token=refresh_token,
            refresh_jti=jti,
            refresh_expires_at=datetime.now(timezone.utc) + refresh_delta,
        )

    def decode_refresh(self, token: str) -> dict:
        """Devuelve claims si es un refresh válido; lanza jwt.PyJWTError si no."""
        payload = decode_token(token)
        if payload.get("type") != TOKEN_TYPE_REFRESH:
            raise jwt.InvalidTokenError("Not a refresh token")
        return payload
