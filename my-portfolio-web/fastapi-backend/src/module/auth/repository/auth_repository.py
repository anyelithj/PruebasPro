"""[REPOSITORY][SRP] persistencia de sesiones/refresh — desacoplada del negocio de auth."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.module.auth.model.password_reset_token_model import PasswordResetTokenModel
from src.module.auth.model.session_model import SessionModel


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_session(self, session_row: SessionModel) -> SessionModel:
        self._session.add(session_row)
        await self._session.flush()
        await self._session.refresh(session_row)
        return session_row

    async def get_active_by_jti(self, jti: str) -> SessionModel | None:
        result = await self._session.execute(
            select(SessionModel).where(
                SessionModel.refresh_jti == jti,
                SessionModel.revoked.is_(False),
            )
        )
        return result.scalar_one_or_none()

    async def revoke_by_jti(self, jti: str) -> None:
        await self._session.execute(
            update(SessionModel).where(SessionModel.refresh_jti == jti).values(revoked=True)
        )
        await self._session.flush()

    async def revoke_expired(self, now: datetime) -> None:
        await self._session.execute(
            update(SessionModel)
            .where(SessionModel.expires_at < now, SessionModel.revoked.is_(False))
            .values(revoked=True)
        )

    # [SEC] tras resetear la contraseña se cierran todas las sesiones abiertas del usuario.
    async def revoke_all_by_user(self, user_id: uuid.UUID) -> None:
        await self._session.execute(
            update(SessionModel).where(SessionModel.user_id == user_id).values(revoked=True)
        )
        await self._session.flush()

    async def create_password_reset(
        self, token_row: PasswordResetTokenModel
    ) -> PasswordResetTokenModel:
        self._session.add(token_row)
        await self._session.flush()
        await self._session.refresh(token_row)
        return token_row

    async def get_valid_password_reset(
        self, token_hash: str
    ) -> PasswordResetTokenModel | None:
        result = await self._session.execute(
            select(PasswordResetTokenModel).where(
                PasswordResetTokenModel.token_hash == token_hash,
                PasswordResetTokenModel.used_at.is_(None),
                PasswordResetTokenModel.expires_at > datetime.now(timezone.utc),
            )
        )
        return result.scalar_one_or_none()

    async def mark_password_reset_used(self, token_id: uuid.UUID) -> None:
        await self._session.execute(
            update(PasswordResetTokenModel)
            .where(PasswordResetTokenModel.id == token_id)
            .values(used_at=datetime.now(timezone.utc))
        )
        await self._session.flush()

    # Invalida los pendientes al emitir uno nuevo: solo el último enlace sirve.
    async def invalidate_pending_password_resets(self, user_id: uuid.UUID) -> None:
        await self._session.execute(
            update(PasswordResetTokenModel)
            .where(
                PasswordResetTokenModel.user_id == user_id,
                PasswordResetTokenModel.used_at.is_(None),
            )
            .values(used_at=datetime.now(timezone.utc))
        )
        await self._session.flush()
