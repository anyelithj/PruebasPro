"""[TDD][SRP] prueba AuthService con DB SQLite real (in-memory)."""

import pytest

from src.common.exceptions.validation_exception import (
    ConflictException,
    UnauthorizedException,
)
from src.module.auth.dto.login_dto import LoginDto
from src.module.auth.dto.refresh_token_dto import RefreshTokenDto
from src.module.auth.dto.register_dto import RegisterDto
from src.module.auth.repository.auth_repository import AuthRepository
from src.module.auth.service.auth_service import AuthService
from src.module.auth.service.token_service import TokenService
from src.module.user.repository.user_repository import UserRepository


def _service(session) -> AuthService:
    return AuthService(UserRepository(session), AuthRepository(session), TokenService())


async def test_register_then_login(db_session) -> None:
    service = _service(db_session)
    reg = await service.register(
        RegisterDto(name="Ana", email="ana@test.dev", password="supersecret")
    )
    assert reg.access_token
    assert reg.user.email == "ana@test.dev"

    logged = await service.login(LoginDto(email="ana@test.dev", password="supersecret"))
    assert logged.access_token
    assert logged.user.id == reg.user.id


async def test_register_duplicate_email_conflicts(db_session) -> None:
    service = _service(db_session)
    await service.register(RegisterDto(name="Ana", email="dup@test.dev", password="supersecret"))
    with pytest.raises(ConflictException):
        await service.register(
            RegisterDto(name="Bob", email="dup@test.dev", password="supersecret")
        )


async def test_login_wrong_password_unauthorized(db_session) -> None:
    service = _service(db_session)
    await service.register(RegisterDto(name="Ana", email="ana@test.dev", password="supersecret"))
    with pytest.raises(UnauthorizedException):
        await service.login(LoginDto(email="ana@test.dev", password="wrongpassword"))


async def test_refresh_rotates_token(db_session) -> None:
    service = _service(db_session)
    reg = await service.register(
        RegisterDto(name="Ana", email="ana@test.dev", password="supersecret")
    )
    refreshed = await service.refresh(RefreshTokenDto(refresh_token=reg.refresh_token))
    assert refreshed.refresh_token != reg.refresh_token

    # el refresh viejo ya fue revocado → no puede reusarse
    with pytest.raises(UnauthorizedException):
        await service.refresh(RefreshTokenDto(refresh_token=reg.refresh_token))
