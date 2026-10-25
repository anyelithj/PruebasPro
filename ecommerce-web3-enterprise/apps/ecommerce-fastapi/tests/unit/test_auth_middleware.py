# test_auth_middleware.py (pytest) => el guard acepta exactamente los JWT que firma Express y
# rechaza el resto.

import base64
import hashlib
import hmac
import json
import time

import pytest

from app.config.app_config import get_settings
from app.shared.middleware.auth_middleware import decode_access_token, require_roles
from app.shared.middleware.error_middleware import AppError


def b64(data: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()


# sign => mismo formato que jsonwebtoken (HS256) en Express
def sign(payload: dict, secret: str | None = None, alg: str = "HS256") -> str:
    header, body = b64({"alg": alg, "typ": "JWT"}), b64(payload)
    key = (secret or get_settings().JWT_ACCESS_SECRET).encode()
    signature = hmac.new(key, f"{header}.{body}".encode(), hashlib.sha256).digest()
    return f"{header}.{body}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode()}"


def payload(**overrides) -> dict:
    base = {"sub": "u1", "email": "a@b.co", "roles": ["ADMIN"], "iss": get_settings().JWT_ISSUER}
    return base | {"exp": int(time.time()) + 60} | overrides


def test_valid_token() -> None:
    user = decode_access_token(sign(payload()))
    assert (user.id, user.roles) == ("u1", ("ADMIN",))


@pytest.mark.parametrize(
    ("token", "code"),
    [
        (sign(payload(), secret="otro-secreto"), "INVALID_TOKEN"),
        (sign(payload(), alg="none"), "INVALID_TOKEN"),
        (sign(payload(iss="otro-emisor")), "INVALID_TOKEN"),
        (sign(payload(exp=int(time.time()) - 1)), "TOKEN_EXPIRED"),
        ("no-es-un-jwt", "INVALID_TOKEN"),
    ],
)
def test_rejected_tokens(token: str, code: str) -> None:
    with pytest.raises(AppError) as error:
        decode_access_token(token)
    assert error.value.code == code


def test_require_roles_forbids_other_roles() -> None:
    customer = decode_access_token(sign(payload(roles=["CUSTOMER"])))
    with pytest.raises(AppError) as error:
        require_roles("ADMIN")(customer)
    assert error.value.status_code == 403
