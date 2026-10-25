"""[TDD][SRP] prueba solo TokenService — sin DB."""

import uuid

import jwt
import pytest

from src.common.constants.app_constants import TOKEN_TYPE_ACCESS
from src.module.auth.service.token_service import TokenService
from src.module.user.model.user_model import UserModel


def _user() -> UserModel:
    u = UserModel(name="Ana", email="ana@test.dev", password_hash="x", role="user")
    u.id = uuid.uuid4()
    return u


def test_access_token_carries_subject_and_type() -> None:
    service = TokenService()
    user = _user()
    token = service.create_access_token(user)
    payload = jwt.decode(token, options={"verify_signature": False})
    assert payload["sub"] == str(user.id)
    assert payload["type"] == TOKEN_TYPE_ACCESS


def test_token_pair_has_unique_refresh_jti() -> None:
    service = TokenService()
    user = _user()
    pair_a = service.create_token_pair(user)
    pair_b = service.create_token_pair(user)
    assert pair_a.refresh_jti != pair_b.refresh_jti


def test_decode_refresh_rejects_access_token() -> None:
    service = TokenService()
    user = _user()
    access = service.create_access_token(user)
    with pytest.raises(jwt.InvalidTokenError):
        service.decode_refresh(access)
